// temporary test file to test the RSA encryption and decryption

const subtle = crypto.subtle;
(async () => {
    let privateKey, publicKey;
    const keyPair = await crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 2048,
            publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
            hash: "SHA-256"
        },
        true,
        ["encrypt", "decrypt"]).then((keyPair) => {
            privateKey = keyPair.privateKey;
            publicKey = keyPair.publicKey;
        }
    )

    privateKey = await crypto.subtle.exportKey('jwk', privateKey)
    publicKey = await crypto.subtle.exportKey('jwk', publicKey)

    let message = 'Hello World!'
    message = new TextEncoder().encode(message); // encode

    const importedpublickey = await subtle.importKey('jwk', publicKey, {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
    }, true, ['encrypt']);

    const encrypted = await subtle.encrypt({
        name: 'RSA-OAEP',
    }, importedpublickey, message); // encrypt the message

    // console.log(encrypted);
    
    const importedprivatekey = await subtle.importKey('jwk', privateKey, {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
    }, true, ['decrypt']);

    const decrypted = await subtle.decrypt({ // decrypt the message
        name: 'RSA-OAEP',
    }, importedprivatekey, encrypted).then(decrypted => {
        console.log('decrypted')
        console.log(new TextDecoder().decode(decrypted));
    });

    // console.log(decrypted)
})();