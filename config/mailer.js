const nodemailer = require('nodemailer')

const main = async () => {
    const transporter = await nodemailer.createTransport({
        service: 'Hotmail',
        auth: {
            user: 'nodemaimer@outlook.com',
            pass: 'Aa1234567!'
        },
    })


    const options = {
        from: 'nodemaimer@outlook.com',
        to: 'martinwiederaan@gmail.com',
        subject: 'hi ho hiiii',
        text: 'my man'
    }

    transporter.sendMail(options, (info, error) => {
        if(error) return console.log(error) 
        console.log(`Sent ${info.response}`)
    })

}

