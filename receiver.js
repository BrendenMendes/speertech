const RedisSMQ = require("rsmq");
const events = require('events');
const eventEmitter = new events.EventEmitter();
const dbOps = require("./dbOps.js")

let messaging_queue = "speertech";

module.exports = (host, port, namespace, dbURL) => {
	console.log(host, port, namespace)
	let rsmq = new RedisSMQ({
	    host: host,
	    port: port,
	    ns: namespace
	});
	setInterval(() => {
		console.log("Checking for messages in queue")
		rsmq.receiveMessage({ qname: messaging_queue }, async (err, resp) => {
			if (err) {
				console.error(err);
				return;
			}
			if (resp.id) {
				console.log('Got message');
				await dbOps.insertDocuments(dbURL, 'chats', JSON.parse(resp.message))
				console.log('saved message to db')
				eventEmitter.emit(JSON.parse(resp.message).sender.toString(), JSON.parse(resp.message).message) //emitting to frontend event listener
				console.log('deleting message')
				rsmq.deleteMessage({ qname: messaging_queue, id: resp.id }, (err) => {
					if (err) {
						console.error(err);
						return;
					}
				});
			} 
			else {
				console.log("no message in queue");
			}
		});
	}, 3000);
}