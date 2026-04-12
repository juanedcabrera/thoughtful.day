// required packages
require('dotenv').config()
const express = require('express')
const cookieParser = require('cookie-parser')
const cryptoJs = require('crypto-js')
const db = require('./models')
const methodOverride = require('method-override');
const helmet = require('helmet');



// app config
const app = express()
const PORT = process.env.PORT || 8000
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://ucarecdn.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com", "https://vjs.zencdn.net"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://ucarecdn.com"],
      connectSrc: ["'self'", "https://upload.uploadcare.com"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'", "https://ucarecdn.com"],
    },
  },
}));
app.set('view engine', 'ejs')
app.use(express.static('public/'))
app.use(methodOverride('_method'))

// middlewares
// parse html from request bodies
app.use(express.urlencoded({ extended: false }))
// tells express to parse incoming cookings sent from the browser
app.use(cookieParser())
app.use((req, res, next) => {
    // incoming request console logger
    // console.log(`[${new Date().toLocaleString()}]: ${req.method} ${req.url}`)
    // console.log('request body:', req.body)
    // send data downstream to the other routes
    // res.locals.myData = 'hi 👋'
    next() // tells express that this middleware has finished
})

app.use(async (req, res, next) => {
    try {
        // check if there is a cookie
        if (req.cookies.userId) {
            // if so we will decrypt the cookie and lookup the user using their PK
            const decryptedPk = cryptoJs.AES.decrypt(req.cookies.userId, process.env.ENC_KEY)
            const decryptedPkString = decryptedPk.toString(cryptoJs.enc.Utf8)
            const user = await db.user.findByPk(decryptedPkString) // eager loading can be done here
            // mount the found user on the res.locals
            // in all other routes you can assume that the res.locals.user is the currently logged in user
            res.locals.user = user
            next() // go to the next thing no matter what
        } else {
            // if there is no cookie, return an unauthorized error
            res.locals.user = null
            next()
        }
    } catch (error) {
        console.log(error)
        // if something goes wrong
        // return an unauthorized error
        res.locals.user = null
        next()
    }
})



  // routes and controllers
app.get('/', (req, res) => {
    if (res.locals.user) {
        res.redirect(`/users/main`);
    } else {
       res.render('home.ejs')
    }
})

app.use('/users', require('./controllers/users.js'))
app.use('/entries', require('./controllers/entry.js'))

  
// listen a port
app.listen(PORT, () => {
    console.log(`authenticating users on port ${PORT}`)
})