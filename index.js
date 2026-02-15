

var board = null
var game = new Chess()
var $status = $('#status')
var $fen = $('#fen')
var $pgn = $('#pgn')
var $uci = $('#uci')
var previousFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
var previousWhiteTime = 0;
var responseData = "";
var gamdID = "";

function engineConfig (){
    return JSON.stringify({
      "limit": JSON.stringify({"type": "time_ms|nodes|depth", "value": 200}),
      "random_seed": 7
    });;
  }

function makeID () {
      return Date.now().toString(36) + Math.random().toString(36).substring(2, 12).padStart(12, 0);
    }

function jsonPost (game_id, client_ply, pre_move_fen, client_uci, bot_id, game_type_id,
  white_ms, black_ms, previous_white_time) {

  const gameData = JSON.stringify({
    "game_id": game_id,
    "client_ply": client_ply,
    "pre_move_fen": pre_move_fen,
    "client_uci": client_uci,
    "bot_id": bot_id,
    "game_type_id": game_type_id,
    "clock": JSON.stringify({"white_ms": white_ms, "black_ms": black_ms}),
    "timing": JSON.stringify({"player_move_elapsed_ms": white_ms-previous_white_time}),
    "engine_config": engineConfig(),
    "request_id": makeID()
  });

  console.log(gameData)

  fetch("Access-Control-Allow-Origin", "https://5izgyd4swtmerhxcwxqgvysmeu0vuodu.lambda-url.us-east-1.on.aws", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: gameData
  })
      .then(resp => {
          if (resp.status === 200) {
              console.log(resp.json())
              return resp.json()
          } else {
              console.log("Status: " + resp.status)
              return Promise.reject("server")
          }
      })
      .then(dataJson => {
          dataReceived = JSON.parse(dataJson)
      })
      .catch(err => {
          if (err === "server") return
          console.log(err)
      })

  }

// Formats time from seconds to HH:MM format
function getClockTime (timeElapsed) {

  var timeLeft = 600 - Math.round(timeElapsed/ 1000);

  const minutes = Math.floor(timeLeft / 60);

  const seconds = timeLeft - minutes * 60;

  // If 0 seconds, ensure double zero is printed
  if (seconds<10){
    var clockUpdatedTime = [
      minutes,
      "0"+seconds.toString(),
    ].join(":")
  }else{
    var clockUpdatedTime = [
      minutes,
      seconds,
    ].join(":")
  }

  return clockUpdatedTime;
}

// Chess clock time helper class
class Timer {
  constructor () {
    this.isRunning = false;
    this.startTime = 0;
    this.overallTime = 0;
  }

  _getTimeElapsedSinceLastStart () {
    if (!this.startTime) {
      return 0;
    }

    return Date.now() - this.startTime;
  }

  // Start timer
  start () {
    if (this.isRunning) {
      return console.error('Timer is already running');
    }

    this.isRunning = true;

    this.startTime = Date.now();
  }

  // Stop timer
  stop () {
    if (!this.isRunning) {
      return console.error('Timer is already stopped');
    }

    this.isRunning = false;

    this.overallTime = this.overallTime + this._getTimeElapsedSinceLastStart();

  }

  //Reset timer
  reset () {
    this.overallTime = 0;

    if (this.isRunning) {
      this.startTime = Date.now();
      return;
    }

    this.startTime = 0;
  }

  //Get total time elapsed
  getTimeElapsed () {
    if (!this.startTime) {
      return 0;
    }

    if (this.isRunning) {
      return this.overallTime + this._getTimeElapsedSinceLastStart();
    }

    return this.overallTime;
  }

}

//Initialize white's clock
const whiteTimer = new Timer();
setInterval(() => {
  document.getElementById('whiteTime').innerText = getClockTime(whiteTimer.getTimeElapsed());
}, 1000)

//Initialize black's clock
const blackTimer = new Timer();
setInterval(() => {
  document.getElementById('blackTime').innerText = getClockTime(blackTimer.getTimeElapsed());
}, 1000)

// Check if this is a fresh board by comparing current fen to default start fen
function isNewGame () {
  return (game.fen() == "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
}

function onDragStart (source, piece, position, orientation) {
  //Fix for drag and drop conflicting with page scroll on mobile
  document.getElementsByTagName('body')[0].style.touch-action = "auto";

  //Alert UCI user is starting the game
  if(isNewGame()) {
    gameID = makeID();

    $uci.html("ucinewgame")
    $uci.html(document.getElementById("uci").textContent + " | \n" + "readyok")
    $uci.html(document.getElementById("uci").textContent + " | \n" + "position startpos")
  }
  // do not pick up pieces if the game is over
  if (game.game_over()) return false

  // only pick up pieces for the side to move
  if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
      (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
    return false
  }
}

function onDrop (source, target) {
  previousFen = game.fen();

  // see if the move is legal
  var move = game.move({
    from: source,
    to: target,
    promotion: 'q' // NOTE: always promote to a queen for example simplicity
  })

  // illegal move
  if (move === null) return 'snapback'

  updateStatus()
}

// update the board position after the piece snap
// for castling, en passant, pawn promotion
function onSnapEnd () {
  board.position(game.fen())

  //Fix for drag and drop conflicting with page scroll on mobile
  document.getElementsByTagName('body')[0].style.touch-action = "auto";
}

function updateStatus () {
  var status = ''

  var moveColor = 'White'

  if (game.turn() === 'w' && !isNewGame()){
    blackTimer.stop();
    whiteTimer.start();
  }

  if (game.turn() === 'b') {
    moveColor = 'Black'
    whiteTimer.stop();
    blackTimer.start();
  }

  // checkmate?
  if (game.in_checkmate()) {
    blackTimer.stop();
    whiteTimer.stop();
    document.getElementById('whiteTimeLabel').innerText = 'Game over, ' + moveColor + ' is in checkmate. White:';
    status = 'Game over, ' + moveColor + ' is in checkmate.';
  }

  // draw?
  else if (game.in_draw()) {
    blackTimer.stop();
    whiteTimer.stop();
    document.getElementById('whiteTimeLabel').innerText = 'Game over, drawn position. White:';
    status = 'Game over, drawn position';
  }

  // game still on
  else {
    status = moveColor + ' to move'

    // check?
    if (game.in_check()) {
      document.getElementById('whiteTimeLabel').innerText = moveColor + ' is in check White:';
      status += ', ' + moveColor + ' is in check'
    }
  }

  $status.html(status)
  $fen.html(game.fen())
  $pgn.html(game.pgn())

  if(isNewGame()) {
    gameID = makeID();
  } else {
    $uci.html(document.getElementById("uci").textContent + " | \n" + "position fen " + game.fen())
  }

  console.log(game.history({ verbose: true }))

  jsonPost (
    gameID,
    game.history().length,
    previousFen,
    game.history({ verbose: true })[game.history().length-1] + game.history({ verbose: true })[game.history().length-1],
    "carlsen",
    "gm_carlsen_blitz",
    whiteTimer.getTimeElapsed(),
    blackTimer.getTimeElapsed(),
    previousWhiteTime
  );

  previousWhiteTime = whiteTimer.getTimeElapsed();
}

// Configuration for chess board
var config = {
  pieceTheme: '/img/chesspieces/wikipedia/{piece}.png',
  draggable: true,
  position: 'start',
  onDragStart: onDragStart,
  onDrop: onDrop,
  onSnapEnd: onSnapEnd
}

//Initialize chess board
board = Chessboard('chessBoard', config)

updateStatus()

function resetArena () {
  blackTimer.reset();
  whiteTimer.reset();
  blackTimer.stop();
  whiteTimer.stop();
  game.reset();
  board.start();
  $status.html(status);
  $fen.html(game.fen());
  $pgn.html(game.pgn());
}

// End current game if user selects new GM
document.addEventListener('DOMContentLoaded', (event) => {
    const selectElement = document.getElementById('gmSelector');
    let previousValue = selectElement.value; // Store the initial value

    selectElement.addEventListener('change', function() {

        // Check that a game is in progress before asking
        if (!isNewGame()) {

          if (confirm('Are you sure you want to switch opponents and end the current game?')) {
              // Confirm selected value
              previousValue = this.value;

              // Reset arena for new game
              resetArena();

          } else {
              // User clicked "Cancel", revert the selection to the previous value
              this.value = previousValue;
          }
        }else{
        //Opponent switched so alert model
      }
    });
});
