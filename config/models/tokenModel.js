const mongoose = require('mongoose')

const tokenSchema = mongoose.Schema({
    userID: {
        type: String,
    }
}, {
    timestamps: true,
})

module.exports = mongoose.model('Token', tokenSchema)