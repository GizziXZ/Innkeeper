const express = require('express');
const fs = require('fs');
const http = require('http');
const https = require('https');
const config = require('./config.json');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const fileupload = require('express-fileupload');

const app = express();

// Load SSL certificate and key
const privateKey = fs.readFileSync('./certificate/selfsigned.key', 'utf8');
const certificate = fs.readFileSync('./certificate/selfsigned.crt', 'utf8');
const credentials = { key: privateKey, cert: certificate };

const httpServer = http.createServer(app);
const httpsServer = https.createServer(credentials, app);
const io = new Server(eval(config.server), {maxHttpBufferSize: 1e7}); // (yes ik eval isn't a good idea, but it's safe here) if using localhost, use httpServer here instead of httpsServer. maxHttpBufferSize is changed to be able to send larger files (1e7 = 10MB)

// TODO - discord emojis
// TODO - possibly voice chat soon

mongoose.connect(config.mongooseConnection + 'usersDB', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// Initialize socket
const { initializeSocket } = require('./sockets/socketHandler');
initializeSocket(io);

// middleware stuff or somethign idk
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(__dirname + '/public'));
app.use(require('./middleware/refreshToken.js'));
app.use(require('./middleware/checkExpiration.js'));
app.use(fileupload());

// Routes
const createRouter = require('./routes/router.js');
const userRoutes = createRouter(io);
app.use(userRoutes);

// app.listen(80);
httpServer.listen(80);
httpsServer.listen(443); // don't do the same mistake i did where i forgot to port forward 443 and was wondering why the site wasn't working on the public web lol