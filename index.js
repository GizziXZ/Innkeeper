const express = require('express');
const http = require('http');
const config = require('./config.json');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// TODO - image sharing (i also want to add the feature discord has where you click on the image and it makes it bigger in the middle of your screen)

mongoose.connect(config.mongooseConnection + 'usersDB', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// Initialize socket
const initializeSocket = require('./sockets/socketHandler');
initializeSocket(io);

// middleware stuff or somethign idk
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(__dirname + '/public'));
app.use(require('./middleware/refreshToken.js'));
app.use(require('./middleware/checkExpiration.js'));
app.use((err, req, res, next) => { // error handling middleware
    if (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
    next();
});

// Routes
const userRoutes = require('./routes/router.js');
app.use(userRoutes);

// Controllers
const userController = require('./controllers/userController.js');

app.post('/login', userController.login);
app.post('/register', userController.register);
app.post('/add-friend', userController.addFriend)
app.post('/remove-friend', userController.removeFriend)
app.post('/friend-requests', userController.friendRequests)

// app.listen(80);
server.listen(80);