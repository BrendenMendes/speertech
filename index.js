const cluster = require('cluster');
const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken')
const rateLimit = require("express-rate-limit");
const RedisSMQ = require("rsmq");
const { v4: uuidv4 } = require('uuid');

const dbURL = "mongodb+srv://"+process.env.DB_USER+":"+process.env.DB_PASSWORD+"@"+process.env.DB_HOST+"/"+process.env.DB_NAME+"?retryWrites=true&w=majority"

const dbOps = require('./dbOps')
const checks = require('./criteriaChecks.js')
const message_queue_receiver = require('./receiver.js')(process.env.REDIS_HOST, process.env.REDIS_PORT, process.env.NAMESPACE, dbURL)

var retryAttemps = 1

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  message: "API limit reached. Try after a while."
});

let messaging_queue = "speertech";

let rsmq = new RedisSMQ({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    ns: process.env.NAMESPACE
});

rsmq.createQueue({qname: messaging_queue}, (err, resp) => {
    if (err) {
        if (err.name !== "queueExists") {
            console.error(err);
            return;
        } 
        else if(resp == 1){
        	console.log("Queue created")
        }
    }
    console.log("queue created");
});

rsmq.listQueues(function (err, queues) {
	if (err) {
		console.error(err)
		return
	}
	console.log("Active queues: " + queues.join( "," ) )
});

// if (cluster.isMaster) {
// 	var cpuCount = require('os').cpus().length;
// 	console.log(cpuCount)
// 	for (var i = 0; i < cpuCount; i += 1) {
//         cluster.fork();
//     }
//     cluster.on('exit', function (worker) {
// 		console.log('Worker %d died', worker.id);
// 	    cluster.fork();
// 	});
// } 
// else{
	const app = express();

	app.use(bodyParser.json());
	app.use(limiter);

	app.get('/', function (req, res) {
        res.sendStatus(200)
    });

    app.post('/signup', signUp)

	app.post('/login', logIn)

	app.post('/create', tokenCheck, crud)

	app.post('/read', tokenCheck, crud)
	
	app.post('/update', tokenCheck, crud)
	
	app.post('/delete', tokenCheck, crud)

	app.post('/message/:recipient', tokenCheck, sendMessage)

    app.listen(process.env.APP_PORT, ()=>{
  		console.log("App running on port: "+process.env.APP_PORT)
  		console.log("Attemting connection to DB")
  		dbOps.connectDB(dbURL)
    });
// }

async function loadPassword(username, password){
	let hashPassword = await dbOps.findDocuments(dbURL, 'users', {username}).catch(error => console.log(err));
	return (bcrypt.compareSync(password, hashPassword[0].password))
}

async function tokenCheck(req, res, next){
	if(!req.body.token){
		res.status(406).send('Missing token')
	}
	else{
		jwt.verify(req.body.token, 'brendenssupersecretkey', function(err, decoded) {
		  	if(err){
				res.status(406).send('bad token value')				
			}
			else{
				next()
			}
		})
	}
}

async function signUp(req, res){
	let password = checks.passwordCriteriaCheck(req.body.password)
	if((checks.userNameCriteriaCheck(req.body.username) || checks.emailCriteriaCheck(req.body.email)) && password.status){
		let username = await dbOps.findDocuments(dbURL, 'users', {$or:[{username : req.body.username}, {email : req.body.email}]}).catch(error => console.log(err));
		if(username.length == 0){
			await dbOps.insertDocuments(dbURL, 'users', {username : req.body.username, password : password.hash, createdOn: new Date().getTime()}).catch(error => console.log(err));
			let token = jwt.sign({ username, password, exp: Math.floor(Date.now() / 1000) + (60 * 60 * 6) }, 'brendenssupersecretkey');
			res.status(200).send({token})
		}
		else{
			res.status(406).send('username already exists')
		}
	}
	else{
		res.status(406).send('username, email and/or password do not satisfy criteria');
	}
}

async function logIn(req, res){
	let password = loadPassword(req.body.username, req.body.password)
	if(checks.userNameCriteriaCheck(req.body.username) && password){
		let token = jwt.sign({ username : req.body.username, password : req.body.password, exp: Math.floor(Date.now() / 1000) + (60 * 60 * 6) }, 'brendenssupersecretkey');
		let tweets = await dbOps.findDocuments(dbURL, 'tweets', {username: req.body.username}).catch(error => console.log(err));
		let chats = await dbOps.findDocuments(dbURL, 'chats', {$or:[{receiver : req.body.username}]}).catch(error => console.log(err))
		res.status(200).send({chats, tweets, token})
	}
	else{
		res.send(406).send('username or password do not match')
	}
}

async function crud(req, res){
	switch(req.route.path){
		case "/create":
			await createTweet(req, res)
			break;
		case "/read":
			await readTweet(req, res)
			break;
		case "/update":
			await updateTweet(req, res)
			break;
		case "/delete":
			await deleteTweet(req, res)
			break;
	}
}

async function createTweet(req, res){
	if(checks.userNameCriteriaCheck(req.body.username) && checks.emailCriteriaCheck(req.body.email) && req.body.tweet.length <= 280){
		let tweetObject = {
			username : req.body.username,
			email : req.body.email,
			tweetID : uuidv4(),
			tweet : req.body.tweet,
			postedOn : new Date().getTime(),
			likes : [],
			retweets : [],
			comments : []
		}
		await dbOps.insertDocuments(dbURL, 'tweets', tweetObject)
		res.status(200).send('Tweet created')
	}
	else{
		res.status(406).send('Missing information')
	}
}

async function readTweet(req, res){
	if(checks.userNameCriteriaCheck(req.body.username)){
		let tweetList = await dbOps.findDocuments(dbURL, 'tweets', {username : req.body.username})
		res.status(200).send(tweetList)
	}
	else{
		res.status(406).send('Missing information')
	}
}

async function updateTweet(req, res){
	if(checks.userNameCriteriaCheck(req.body.username) && req.body.tweetID && req.body.tweet){
		await dbOps.updateDocument(dbURL, 'tweets', { tweetID : req.body.tweetID }, { tweet : req.body.tweet })
		res.status(200).send('Tweet updated')
	}
	else{
		res.sendStatus(500)
	}
}

async function deleteTweet(req, res){
	if(checks.userNameCriteriaCheck(req.body.username) && req.body.tweetID){
		await dbOps.deleteDocument(dbURL, 'tweets', { tweetID : req.body.tweetID })
		res.status(200).send('Tweet deleted')
	}
	else{
		res.sendStatus(500)
	}
}

async function sendMessage(req, res){
	if(req.body.username && req.body.messageType && req.body.messageType.includes("text", "image", "document") && req.body.message){
		rsmq.sendMessage({
	        qname: messaging_queue,
	        message: JSON.stringify({sender : req.body.username, recipient : req.params.recipient, messageType : req.body.messageType, message : req.body.message, dateTime : new Date().getTime()}),
	        delay: 0
	    }, (err) => {
	        if (err) {
	            console.error(err);
	            return;
	        }
	    });
	    console.log("pushed new message into queue");
	    res.status(200).send('Message sent')
	}
	else{
		res.status(406).send("Insufficient/wrong key parameters in request body")
	}
}
