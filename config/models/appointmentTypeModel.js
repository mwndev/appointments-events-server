const mongoose = require('mongoose')

const typeSchema = mongoose.Schema({
    price: {
        type: Number,
        required: [true, 'enter a price'],
    },
    description: {
        type: String,
        required: [true, 'enter a description'],
    },
    participants: {
        max: {
            type: Number,
            required: [true, 'enter maximum participants'],
        },
        min: {
            type: Number,
            default: 1,
        }
    },
    category: {
        type: String,
        required: [true, 'enter category such as - Event, Consultation, ']
    }
}, {
    timestamps: true,
})

module.exports = mongoose.Model('AppointmentType', typeSchema)