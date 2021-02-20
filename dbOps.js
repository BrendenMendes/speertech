const MongoClient = require('mongodb').MongoClient

module.exports = {
	connectDB,
	findDocuments,
	insertDocuments,
	updateDocument,
	deleteDocument
}

function connectDB(dbURL){
	MongoClient.connect(dbURL, function(err, client) {
		if(err){
			console.log(err)
			console.log("Error occured. Attempting to retry in "+retryAttemps+" seconds")
			setTimeout(()=>{
				retryAttemps += retryAttemps
				connectDB()
			}, retryAttemps * 1000)
		}
		else{
  			const db = client.db(process.env.DB_NAME);
  			console.log("Connected to MongoDB!")
  			client.close();
  		}
	})
}

function findDocuments(dbURL, collectionName, input) {
	return new Promise((resolve, reject)=>{
		MongoClient.connect(dbURL, function(err, client) {
			if(err){
				reject(err)
			}
			else{
				const db = client.db(process.env.DB_NAME);
				const collection = db.collection(collectionName);
				collection.find(input).toArray(function(err, docs) {
				    if(err){
				    	reject('failed at find docs');
				    }
				    client.close();
				    resolve(docs)
				});
			}
		})
	})
	
}

function insertDocuments(dbURL, collectionName, input) {
  	return new Promise((resolve, reject)=>{
  		MongoClient.connect(dbURL, function(err, client) {
			if(err){
				reject(err)
			}
			else{
	  			const db = client.db(process.env.DB_NAME);
		  		const collection = db.collection(collectionName);
			  	collection.insertOne(input, function(err, result) {
			    	if(err){
			    		reject('failed at insert docs')
			    	}
			    	client.close();
			    	resolve(result)
			  	});
			}
		})
  	})
}

function updateDocument(dbURL, collectionName, oldInfo, newInfo) {
	return new Promise((resolve, reject)=>{
		MongoClient.connect(dbURL, function(err, client) {
			if(err){
				reject(err)
			}
			else{
				const db = client.db(process.env.DB_NAME);
				const collection = db.collection(collectionName);
				collection.updateOne(oldInfo, { $set: newInfo }, function(err, result) {
					if(err){
						reject('failed at update docs')
					}
					client.close()
					resolve(result)
				});
			}
		})
	})
}

function deleteDocument(dbURL, collectionName, input) {
	return new Promise((resolve, reject)=>{
		MongoClient.connect(dbURL, function(err, client) {
			if(err){
				reject(err)
			}
			else{
				const db = client.db(process.env.DB_NAME);
				const collection = db.collection(collectionName);
				collection.deleteOne(input, function(err, result) {
					if(err){
						reject('failed at update docs')
					}
					client.close()
					resolve(result)
				});
			}
		})
	})
}