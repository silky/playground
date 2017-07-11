module.exports = smoothPath;

function smoothPath(path) {
  let prevSegment = segment(path[0], path[1]);
  let svg_path = 'M' + point(path[0])

  for (var i = 1; i < path.length - 1; i++) {
    let prevSplit = splitSegment(prevSegment, 0.75)
    svg_path += 'L' + point(prevSplit[1]) + ' '

    let nextSegment = segment(path[i], path[i + 1])
    let lastControlPointSegment = segment(prevSplit[1], prevSplit[2])
    let lastControlPointSplit = splitSegment(lastControlPointSegment, 0.5)

    let nextSplit = splitSegment(nextSegment, 0.25)
    let nextControlPointSegment = segment(nextSplit[0], nextSplit[1]);
    let nextControlPointSplit = splitSegment(nextControlPointSegment, 0.5)

    svg_path += 'C ' + point(lastControlPointSplit[1]) + ' ' +
      point(nextControlPointSplit[1]) + ' ' +
      point(nextControlPointSplit[2]) + ' '

    prevSegment = nextSegment
  }

  if (path.length > 1) svg_path += 'L' + point(path[path.length - 1])

  return svg_path;


  function point(p) {
    return p.x + ',' + p.y
  }
  function segment(from, to) {
    return {
      from: from,
      to: to
    }
  }

  function splitSegment(segment, ratio) {
    var dx = segment.to.x - segment.from.x
    var dy = segment.to.y - segment.from.y

    var length = Math.sqrt(dx * dx + dy * dy)
    var ux = dx / length;
    var uy = dy / length;
    var step = length * ratio;

    var points = [{
      x: segment.from.x,
      y: segment.from.y
    }, {
      x: segment.from.x + ux * step,
      y: segment.from.y + uy * step
    }, {
      x: segment.to.x,
      y: segment.to.y
    }]

    return points
  }
}
