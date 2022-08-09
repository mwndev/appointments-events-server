const mongoose = require('mongoose')

const problemSchema = mongoose.Schema({
    description: {
        type: String
    },
    details: {
        type: Object,
    },
    other: {
        type: Object,
    },
}, {timestamps: true})

module.exports = mongoose.model('Problem', problemSchema)