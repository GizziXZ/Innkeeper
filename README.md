# Innkeeper
### UI
![image](https://github.com/user-attachments/assets/50e60f51-9144-47e8-a928-c4c2a54c03e7)

### images, gifs, videos and custom status messages
![image](https://github.com/user-attachments/assets/6ac43ef1-44f3-4507-b711-3c71cef6abcb)


### **Discord-like End to End Encrypted messaging service**

I locked discord and signal in a room and forced them to have a child and I came out with Innkeeper, a private messaging service where none of your messages (encrypted and/or unencrypted) are saved on the server. best of all, the server never even has your private key in the first place, only your public key is saved to a database.

most of the magic is done in your browser, key generation, encryption and decryption. hell, even the messages are saved in your browser. the server is essentially only used to relay information to keep your ip private (unless you click on an ip logger, that's on you)

## enough talkin, fella. how does it work?

you type on your keyboard and it works (sometimes)

for real though, once you've made an account, the password is hashed like every website with an account registration system and your account is then sent to the database. (check `/models/users.js` for reference to see what is stored on the database)

once you've logged in, we use jsonwebtokens to verify your session (basically, it works like a discord token. once it's stolen someone can end up using your account as you!), and then a RSA keypair is generated using your browser. the public key is sent to the database and the private key is saved on your browser for future decryptions.

## How does communication between users work?

an AES symmetric key is generated for every chat you have, once it is generated, it will be encrypted using the other user's public key and sent to them. the other user will decrypt the symmetric key using their own private key.

every message is encrypted using the shared AES symmetric key before being sent to the other user through the server, hence the end to end encryption

this method of encryption is called [hybrid encryption.](https://en.wikipedia.org/wiki/Hybrid_cryptosystem)

## Why are you not just encrypting everything directly with the RSA keypair, idiot

because AES is more efficient than RSA and RSA is only able to encrypt data to a maximum amount equal to your key size (2048 bits = 256 bytes)

this means the size of any messages you send are limited to 256 bytes if you are using RSA and you also cannot encrypt most files because of that. using AES allows you to send large files and messages.

## What happens if I login on another browser?

your keypair will be regenerated over the existing one and the public key on the server will be replaced with the new one and all symmetric keys will be regenerated, this is a privacy feature.

## mr headset dog, can i rely on this application for my illegal drug dealing operations

absolutely not, i am literally a 16 year old and i don't know what i'm doing, it's probably extremely insecure in some way and i wouldn't be surprised if it is.


# Features

* Auto delete messages after a period of time
* Set a profile picture
* Set a custom status message
* Send any type of media, entirely encrypted (you can also zoom in by clicking on a picture or gif like on discord!)
* Create end to end encrypted groupchats with friends
* Block users to prevent them from being able to send you a friend request
* (almost) the same emoji system discord uses, you can use colons to use a specific emoji while typing like :pensive: (😔) or you can use the emoji picker tab. Innkeeper also uses the same emoji art as discord
* and of course, end to end encryption using hybrid encryption

# Setting it up

Make sure you have [Nodejs](https://nodejs.org/en) downloaded.

## Config

create a config.json and follow this template

```json
{
    "mongooseConnection":"mongodb+srv://your.mongodb.server/",
    "jwtSecret":"jsonwebtoken secret",
    "server":"httpServer or httpsServer"
}
```

your jwtSecret is like a password used for signing jsonwebtokens to make sure they're legit when logging in.

if you're going to use localhost you can set server to httpServer, if you're hosting this outside of localhost then use httpsServer and make sure you've got an ssl certificate

## Certificate

make a folder named `certificate` and place your .crt and .key files inside it. (not necessary if you're going to use httpServer)

## Hosting

once all of that is done, make sure you have run this command inside the Innkeeper folder:

```bash
npm i
```

and to finally run it:

```bash
node index.js
```

# Contributions

Open issues with any bugs/errors you find, you can also try to make my unreadable code better by contributing and helping with making the service more secure.