var eventify = require('ngraph.events');
var measureText = require('./lib/measureText.js');
var makeGrid = require('./lib/makeGrid.js');
var WordLayoutModel = require('./lib/WordLayoutModel.js');

module.exports = wordCloud;

function wordCloud(words, settings) {
  words.sort(bySize);

  var grid = makeGrid();
  var lastProcessedWordIndex = 0;
  var api = {
    mask: grid.mask
  }

  eventify(api);

  setTimeout(loop, 0);

  return api;

  function loop() {
    if (lastProcessedWordIndex < words.length - 1) {
      setTimeout(loop, 0);
    }
    var word = words[lastProcessedWordIndex];
    console.time('search' + word[0])
    var wordPosition = findPosition(word);
    console.timeEnd('search' + word[0])
    if (wordPosition) triggerPositionFound(wordPosition);

    lastProcessedWordIndex += 1;
  }

  function findPosition(word) {
    var wordPosition = new WordLayoutModel(word, settings.fontFamily);
    var box = measureText(wordPosition)
    if (!box) return;

    var spot = grid.findSpot(box)

    if (spot) {
      grid.useSpot(spot);
      wordPosition.setSpot(spot);

      return wordPosition;
    }
  }

  function triggerPositionFound(word) {
    api.fire('position', word);
  }
}


function bySize(x, y) {
  // element at position 1 is font size.
  return y[1] - x[1];
}
