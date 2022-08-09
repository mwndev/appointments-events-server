const mongoose = require('mongoose')

const userSchema = mongoose.Schema({
    firstName: {
        type: String,
        required: [true, 'enter first name']
    },
    lastName: {
        type: String,
        required: [true, 'enter last name']
    },
    email: {
        type: String,
        required: [true, 'enter email'],
    },
    //DELETE THIS COMMENT ONCE THE PASSWORDS ARE ENCRYPTED 
    password: {
        type: String,
        required: [true, 'enter a password'],
    },
    loginTimes: {
        type: Array,
        default: [],
    },
})

module.exports = mongoose.model('User', userSchema)