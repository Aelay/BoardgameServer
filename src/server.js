// http://ejohn.org/blog/ecmascript-5-strict-mode-json-and-more/
"use strict";
 
// Optional. You will see this name in eg. 'ps' or 'top' command
process.title = 'node-boardgameserver';
 
// Port where we'll run the websocket server
var webSocketsServerPort = 1337;
 
// websocket and http servers
var webSocketServer = require('websocket').server;
var http = require('http');
 
/**
 * Global variables
 */
// latest 100 messages
//var history = [ ];
// list of currently connected clients (users)
var clients = [ ];

var rooms = {};

function addRoom(name, data) {
    if(rooms[name]) {
        return;
    }
    
    var room = {
        clients: [],
        lastUsed: (new Date()).getTime(),
        history: [],
        creator: null,
        permanent: false
    };
    
    for(var index in data) {
        room[index] = data[index];
    }
    
    rooms[name] = room;
    
    console.log('Added room ' + name);
}

addRoom('lobby', {permanent: true});
 
/**
 * Helper function for escaping input strings
 */
function htmlEntities(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
 
// Array with some colors
var colors = [ 'red', 'green', 'blue', 'magenta', 'purple', 'plum', 'orange' ];
// ... in random order
colors.sort(function(a,b) { return Math.random() > 0.5; } );
 
/**
 * HTTP server
 */
var server = http.createServer(function(request, response) {
    // Not important for us. We're writing WebSocket server, not HTTP server
});
server.listen(webSocketsServerPort, function() {
    console.log((new Date()) + " Server is listening on port " + webSocketsServerPort);
});
 
/**
 * WebSocket server
 */
var wsServer = new webSocketServer({
    // WebSocket server is tied to a HTTP server. WebSocket request is just
    // an enhanced HTTP request. For more info http://tools.ietf.org/html/rfc6455#page-6
    httpServer: server
});
 
// This callback function is called every time someone
// tries to connect to the WebSocket server
wsServer.on('request', function(request) {
    console.log((new Date()) + ' Connection from origin ' + request.origin + '.');
 
    // accept connection - you should check 'request.origin' to make sure that
    // client is connecting from your website
    // (http://en.wikipedia.org/wiki/Same_origin_policy)
    var connection = request.accept(null, request.origin); 
    // we need to know client index to remove them on 'close' event
    var index = clients.push(connection) - 1;
    var connected = false;
    var userData = {
        name: false,
        color: false,
        room: null
    };
    
    joinRoom('lobby');
 
    console.log((new Date()) + ' Connection accepted.');
 
    
    
    function joinRoom(roomName) {
        if(rooms[roomName]) {
            userData.room = rooms[roomName];
            rooms[roomName].clients.push(connection);
    
            // send back chat history
            if (userData.room.history.length > 0) {
                connection.sendUTF(JSON.stringify({ type: 'history', data: userData.room.history }));
            }
        }
    }
    
    var messageHandlers = {};
    
    messageHandlers['userData'] = function(data) {
        for(var index in data) {
            userData[index] = data[index];
            
            if(index == 'name') {
                userData['color'] = colors.shift();
                connection.sendUTF(JSON.stringify({ type:'color', data: userData['color'] }));
                connected = true;
            }
        }
    };
    
    /*messageHandlers['name'] = function(data) {
        // remember user name
        userName = htmlEntities(data);
        // get random color and send it back to the user
        userColor = colors.shift();
        connection.sendUTF(JSON.stringify({ type:'color', data: userColor }));
        console.log((new Date()) + ' User is known as: ' + userName
                    + ' with ' + userColor + ' color.');
    };*/
    
    messageHandlers['message'] = function(data) {
        console.log((new Date()) + ' Received Message from '
                    + userData['name'] + ': ' + data);
        
        if(userData.room) {
            // we want to keep history of all sent messages
            var obj = {
                time: (new Date()).getTime(),
                text: htmlEntities(data),
                author: htmlEntities(userData['name']),
                color: userData['color']
            };
            userData.room.history.push(obj);
            userData.room.history = userData.room.history.slice(-100);
    
            // broadcast message to all connected clients
            var json = JSON.stringify({ type:'message', data: obj });
            for (var i=0; i < clients.length; i++) {
                clients[i].sendUTF(json);
            }
            
            userData.room.lastUsed = (new Date()).getTime();
        }
    };

    messageHandlers['default'] = function(data) {
	    console.log('Unexpected message', data);
    };

    // user sent some message
    connection.on('message', function(message) {
        if (message.type === 'utf8') { // accept only text
        	try {
        		var json = JSON.parse(message.utf8Data);
        
        		if(typeof(messageHandlers[json.type]) != 'undefined') {
        		    messageHandlers[json.type](json.data);
        		} else {
        		    messageHandlers['default'](json);
        		}
            } catch(exc) {
        		console.log('Can\'t parse JSON.', exc, message);
            }
        }
    });
 
    // user disconnected
    connection.on('close', function(connection) {
        if (connected) {
            console.log((new Date()) + " Peer "
                + connection.remoteAddress + " disconnected.");
            // remove user from the list of connected clients
            clients.splice(index, 1);
            // push back user's color to be reused by another user
            colors.push(userData['color']);
        }
    });
 
});

