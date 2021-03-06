(function() {
  var net = require('net');
  
  var socket = null;
  var latest = {};
  var listening = false;
  var port = 6555;
  var socket_errors = 0;
  var eyetribe = {
    setup: function() {
      
    },
    stop_listening: function() {
      listening = false;
      if(socket) {
        socket.destroy();
      }
      socket = null;
    },
    listen: function() {
      if(socket) { return; }
      latest = {
        gaze_ts: 0
      };
      socket = new net.Socket();
      socket.heartbeatCounter = 0;
      socket.on('data', function(raw_data) {
        var data = null;
        try {
          data = JSON.parse(raw_data);
        } catch(e) { }
        if(!data) { return; }
        
        if(data.values && data.values.frame) {
          var trackState = data.values.frame.state;
          if(!socket.readyNotified) {
            socket.readyNotified = true;
            console.log("eyetribe state changed to \"tracker_ready\"");
          } else if(socket.lastTrackState != trackState) {
            socket.lastTrackState = trackState;
            var state = "not_tracking";
            if(trackState < 8) {
              state = "fully_tracking";
              if(trackState < 7) {
                state = "partial_tracking";
              }
            }
            console.log("eyetribe state changed to \"" + state + "\"");
            latest.gaze_state = state;
          }
          // console.log(data.values.frame.state + "  " + data.values.frame.avg.x + "," + data.values.frame.avg.y);
          if(data.values.frame.state < 8) {
            latest.gaze_x = data.values.frame.avg.x;
            latest.gaze_y = data.values.frame.avg.y;
            latest.gaze_ts = (new Date()).getTime();
            // console.log("found " + latest.gaze_x + ", " + latest.gaze_y);
          }
        } else {
          //console.log(data);
        }
        socket.heartbeatCounter++;
        if(data.request == "get" && data.values && data.values.push === false) {
          console.log("eyetribe connected. state: " + JSON.stringify(data.values));
          latest.screen_width = data.values.screenresw;
          latest.screen_height = data.values.screenresh;
          socket.write(JSON.stringify({category: "tracker", request: "set", values: {"push": true}}));
        } else if(socket.heartbeatCounter > 5 && listening) {
          socket.heartbeatCounter = 0;
          socket.write(JSON.stringify({category: "heartbeat"}));
        }
      });
      socket.on('close', function() {
        console.log("socket closed");
        eyetribe.stop_listening();
      });
      socket.on('error', function() {
        console.log("socket error");
        socket_errors++;
        eyetribe.stop_listening();
      });
      socket.connect(port, function() {
        listening = true;
        console.log('socket connected! sending initial message');
        var json = {
          "category": "tracker",
          "request" : "get",
          "values": [ "push", "iscalibrated", "screenresw", "screenresh" ]
        };
        socket.write(JSON.stringify(json));
      });
    },
    ping: function() {
      // if not already listening, go ahead and start listening
      if(!listening && socket_errors < 10) {
        eyetribe.listen();
      }
      return latest;
    }
  };
  module.exports = eyetribe;
})();