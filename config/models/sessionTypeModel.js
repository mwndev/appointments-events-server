const mongoose = require('mongoose')

const typeSchema = mongoose.Schema({
    price: {
        type: Number,
        required: [true, 'enter a price'],
    },
    name: {
        type: String,
        required: [true, 'enter a name'],
    },
    description: {
        type: String,
        required: false,
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
        default: 'flexible',
    },
    isActive: {
        type: Boolean,
        default: true,
    }
}, {
    timestamps: true,
})

module.exports = mongoose.model('SessionType', typeSchema)