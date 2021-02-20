const bcrypt = require('bcrypt');
const saltRounds = 10;

module.exports = {
	userNameCriteriaCheck,
	emailCriteriaCheck,
	passwordCriteriaCheck
}

function userNameCriteriaCheck(username){
	let text = username.match(/[$&+,:;=?@#|'<>.^*()%!-]/)
	if(text && text[0]){
		return false
	}
	else{
		return true
	}
}

function emailCriteriaCheck(email){
	let text = email.match(/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/)
	if(text && text[0]){
		return true
	}
	else{
		return false
	}
}

function passwordCriteriaCheck(password){
	let text = password.match(/[\w\d_@./#&+-]{10,}/)
	if(text != null && text[0] && text[0] == password){
		let hash = bcrypt.hashSync(password, saltRounds)
		return {status : true, hash}
	}
	else{
		return {status : false, password : null}
	}
}