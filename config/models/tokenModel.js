const mongoose = require('mongoose')
const {Temporal} = require("@js-temporal/polyfill")
const { temporalDateToNum } = require('../../helperfunctions')


const tokenSchema = mongoose.Schema({
    userID: {
        type: String,
    },
    numDateCreatedAt: {
        type: String,
        default: temporalDateToNum(Temporal.Now.plainDateTimeISO()),
    },
    for: {
        type: String,
        required: [true, 'which type of Token is this?\n-confirmUser\n-forgotPassword\n(remember String type)']
    },
    other: {
        type: Object,
        required: false,
    }
})

module.exports = mongoose.model('Token', tokenSchema)