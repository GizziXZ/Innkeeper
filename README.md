# Innkeeper
~~*(screenshots here after the project is entirely done, hopefully)*~~

**Discord-like End to End Encrypted messaging service**

I locked discord and signal in a room and forced them to have a child and I came out with Innkeeper, a private messaging service where none of your messages (encrypted and/or unencrypted) are saved on the server. best of all, the server never even has your private key in the first place, only your public key is saved to a database.

most of the magic is done in your browser, key generation, encryption and decryption. hell, even the messages are saved in your browser. the server is essentially only used to relay information to keep your ip private (unless you click on an ip logger, that's on you)

## enough talkin, fella. how does it work?

you type on your keyboard and it works (sometimes)

for real though, once you've made an account, the password is hashed like every website with an account registration system and your account is then sent to the database. (check /models/users.js for reference to see what is stored on the database)

once you've logged in, we use jsonwebtokens to verify your session (basically, it works like a discord token. once it's stolen someone can end up using your account as you!), and then a RSA keypair is generated using your browser. the public key is sent to the database and the private key is saved on your browser for future decryptions.

## How does communication between users work?

an AES symmetric key is generated for every chat you have, once it is generated, it will be encrypted using the other user's public key and sent to them. the other user will decrypt the symmetric key using their own private key.

every message is encrypted using the shared AES symmetric key before being sent to the other user through the server, hence the end to end encryption

## What happens if I login on another browser?

your keypair will be regenerated over the existing one and the public key on the server will be replaced with the new one, this is a privacy feature.


# Setting it up

## Config

create a config.json and follow this template

```json
    {
        "mongooseConnection":"your.mongodb.server/",
        "jwtSecret":"jsonwebtoken secret",
        "server":"httpServer or httpsServer"
    }
```

your jwtSecret is like a password used for signing jsonwebtokens to make sure they're legit when logging in. 
if you're going to use localhost you can set server to httpServer, if you're hosting this outside of localhost then use httpsServer and make sure you've got an ssl certificate

## Certificate

make a folder named `certificate` and place your .crt and .key files inside it. (not necessary if you're going to use httpServer)