const http = require("http");
const crypto = require('crypto');

const WEB_SOCKET_MAGIC_STRING = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const SEVEN_BITS_INTEGER_MARKER = 125;
const SIXTEEN_BITS_INTEGER_MARKER = 126;
const MASK_BYTES_SIZE = 4;

console.log("Create server ...");

const hostname = 'localhost';
const port = 3000;
const server = http.createServer((req, res) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Hello World\n');
});
server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});

server.on("upgrade", (req, socket, head) => {
    const clientWebSocketKey = req.headers['sec-websocket-key'];
    console.log(`Upgrade event received from client ${clientWebSocketKey}`);

    const webSocketAccept = crypto.createHash('sha1').update(clientWebSocketKey + WEB_SOCKET_MAGIC_STRING, 'utf8').digest('base64');
    console.log(webSocketAccept);

    const headers = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${webSocketAccept}`,
        ''
    ].map(l => l.concat("\r\n")).join("");

    socket.write(headers);

    socket.on("readable", () => onReadableSocket(socket));
});

function onReadableSocket(socket) {
    const byte_with_1 = parseInt('10000000', 2);
    socket.read(1); // useless

    const [markerAndPayloadLengh] = socket.read(1)
    const lengthIndicatorInBits = markerAndPayloadLengh - byte_with_1

    let messageLength = 0
    if (lengthIndicatorInBits <= SEVEN_BITS_INTEGER_MARKER) {
        messageLength = lengthIndicatorInBits
    }
    else if (lengthIndicatorInBits === SIXTEEN_BITS_INTEGER_MARKER) {
        // unsigned, big-endian 16-bit integer [0 - 65K] - 2 ** 16
        messageLength = socket.read(2).readUint16BE(0)
    }
    else {
        throw new Error(`Message too long`);
    }


    console.log(`Message length: ${messageLength}`);
    console.log(`Reading mask bytes ...`);

    const maskKey = socket.read(MASK_BYTES_SIZE);
    const messageEncoded = socket.read(messageLength);
    const result = decodeMessage(messageEncoded, maskKey);
    console.log();
}


function decodeMessage(messageEncoded, maskKey) {
    return Buffer.from(Uint8Array.from(messageEncoded, (elt, i) => elt ^ maskKey[i % MASK_BYTES_SIZE])).toString("utf-8");
}