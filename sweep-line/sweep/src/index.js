export default findIntersections;

import SplayTree from 'splaytree';

import {intersectSegments, EPS, pseudoAngle} from './geom';
import createSweepStatus from './sweepStatus';

var START_ENDPOINT = 1;
var FINISH_ENDPOINT = 2;
var INTERSECT_ENDPOINT = 3;

class SweepEvent {
  constructor(kind, point, segment, oneMore) {
    this.kind = kind;
    this.checkDuplicates = false;
    if (Math.abs(point.x) < EPS) point.x = 0;
    if (Math.abs(point.y) < EPS) point.y = 0;

    this.point = point;
    if (kind === START_ENDPOINT) {
      this.from = [segment];
    } else if (kind === FINISH_ENDPOINT) {
      this.to = [segment]
    } else if (kind === INTERSECT_ENDPOINT) {
      this.interior = [segment, oneMore];
      this.knownInterior = new Set();
      this.interior.forEach(l => this.knownInterior.add(l));
    }
  }

  merge(other) {
    if (this.kind !== other.kind) this.checkDuplicates = true;

    if (other.kind === START_ENDPOINT) {
      if (!this.from) this.from = [];
      other.from.forEach(s => this.from.push(s));
    } else if (other.kind === FINISH_ENDPOINT) {
      if (!this.to) this.to = [];
      other.to.forEach(s => this.to.push(s));
    } else if (other.kind === INTERSECT_ENDPOINT) {
      if (!this.interior) {
        this.interior = [];
        this.knownInterior = new Set();
      }

      other.interior.forEach(s => {
        // TODO: Need to not push if we already have such segments.
        if (!this.knownInterior.has(s)) {
          this.interior.push(s);
          this.knownInterior.add(s);
        }
      });
    }
  }
}

function createEventQueue() {
  const q = new SplayTree(byY);

  return {
    isEmpty: isEmpty,
    size: size,
    pop: pop,
    push: push,
    find: find,
    merge: merge,
    insert: insert
  }

  function find(p) {
    return q.find(p);
  }

  function size() {
    return q.size;
  }

  function isEmpty() {
    return q.isEmpty();
  }

  function push(event) {
    var current = q.find(event.point);
    if (current) {
      return current.data.merge(event);
    } else {
      q.insert(event.point, event);
    }
  }

  function insert(event) {
    q.insert(event.point, event);
  }

  function merge(current, event) {
    current.data.merge(event);
  }

  function pop() {
    var node = q.pop();
    return node && node.data;
  }
}

function byY(a, b) {
  // decreasing Y 
  var res = b.y - a.y;
  // TODO: This might mess up the status tree.
  if (Math.abs(res) < EPS) {
    // increasing x.
    res = a.x - b.x;
    if (Math.abs(res) < EPS) res = 0;
  }

  return res;
}

var EMPTY = [];

function findIntersections(lines, options) {
  var eventQueue = createEventQueue();
  var sweepStatus = createSweepStatus();
  var results = (options && options.results) || [];
  var reportIntersection = (options && options.ignoreEndpoints) ? 
    reportIgnoreEndpoints : 
    reportIncludeIntersection;

  lines.forEach(insertEndpointsIntoEventQueue);
  if (options && options.control) {
    return {
      next
    };
  }

  var printDebug = false; // options && options.debug;

  while (!eventQueue.isEmpty()) {
    var eventPoint = eventQueue.pop();
    handleEventPoint(eventPoint);
  }

  return results;

  function next() {
    if (eventQueue.isEmpty()) {
      options.control.done(results);
    } else {
      var eventPoint = eventQueue.pop();
      handleEventPoint(eventPoint);
      options.control.step(sweepStatus, results, eventQueue)
    }
  }

  function union(a, b) {
    if (!a) return b;
    if (!b) return a;

    return a.concat(b);
  }

  function handleEventPoint(p) {
    var interior = p.interior || EMPTY;
    var lower = p.to || EMPTY; 
    var upper = p.from || EMPTY;
  
    // if (printDebug) {
    //   console.log('handle event point', p.point, p.kind);
    // }
    var uLength = upper.length;
    var iLength = interior.length;
    var lLength = lower.length;

    if (uLength + iLength + lLength > 1) {
      p.isReported = true;
      if (p.checkDuplicates) {
        // the event was merged from another kind. We need to make sure
        // that no interior point are actually lower/upper point
        interior = removeDuplicate(interior, lower, upper);
        iLength = interior.length;
        p.checkDuplicate = false;
      }
      reportIntersection(p.point, interior, lower, upper);
    }

    if (p.checkDuplicates) {
      // the event was merged from another kind. We need to make sure
      // that no interior point are actually lower/upper point
      interior = removeDuplicate(interior, lower, upper);
      iLength = interior.length;
    }
    sweepStatus.deleteSegments(lower, interior, p.point);
    sweepStatus.insertSegments(interior, upper, p.point);

    if (printDebug) {
      sweepStatus.checkDuplicate();
    }

    var sLeft, sRight;

    var hasNoCrossing = (uLength + iLength === 0);

    if (hasNoCrossing) {
      var leftRight = sweepStatus.getLeftRightPoint(p.point);
      sLeft = leftRight.left;
      if (!sLeft) return;

      sRight = leftRight.right;
      if (!sRight) return;

      findNewEvent(sLeft, sRight, p);
    } else {
      var boundarySegments = sweepStatus.getBoundarySegments(upper, interior);

      findNewEvent(boundarySegments.beforeLeft, boundarySegments.left, p);
      findNewEvent(boundarySegments.right, boundarySegments.afterRight, p);
    }
  }

  function findNewEvent(left, right, p) {
    if (!left || !right) return;

    var intersection = intersectSegments(left, right);
    if (!intersection) return;

    var dy = p.point.y - intersection.y
    // TODO: should I add dy to intersection.y?
    if (dy < -EPS) {
      // this means intersection happened after the sweep line. 
      // We already processed it.
      return;
    }

    // Need to adjust floating point for this special case,
    // since otherwise it gives rounding errors:
    if (Math.abs(intersection.x) < EPS) intersection.x = 0;
    if (Math.abs(intersection.y) < EPS) intersection.y = 0;

    var current = eventQueue.find(intersection);
    if (current && current.isReported) {
      debugger;
      // We already reported this event. No need to add it one more time
      // TODO: Is this case even possible?
      return;
    }

    var event = new SweepEvent(INTERSECT_ENDPOINT, intersection, left, right)
    if (current) {
      eventQueue.merge(current, event);
    } else {
      eventQueue.insert(event);
    }
  }

  function reportIncludeIntersection(p, interior, lower, upper) {
    results.push({
      point: p, 
      segments: union(union(interior, lower), upper)
    });
  }

  function reportIgnoreEndpoints(p, interior) {
    if (interior.length > 0) {
      results.push({
        point: p, 
        segments: interior
      });
    }
  }

  function insertEndpointsIntoEventQueue(segment) {
    var from = segment.from;
    var to = segment.to;

    roundNearZero(from);
    roundNearZero(to);

    var dy = from.y - to.y;
    if (Math.abs(dy) < 1e-5) {
      from.y = to.y;
      segment.dy = 0;
    }
    if ((from.y < to.y) || (
        (from.y === to.y) && (from.x > to.x))
      ) {
      var temp = from;
      from = segment.from = to; 
      to = segment.to = temp;
    }
    segment.dy = from.y - to.y;
    segment.dx = from.x - to.x;
    segment.angle = pseudoAngle(segment.dy, segment.dx);

    var startEvent = new SweepEvent(START_ENDPOINT, from, segment)
    var endEvent = new SweepEvent(FINISH_ENDPOINT, to, segment)
    eventQueue.push(startEvent);
    eventQueue.push(endEvent)
  }
}

function removeDuplicate(interior, lower, upper) {
  var result = [];
  for (var i = 0; i < interior.length; ++i) {
    var s = interior[i];
    if (lower.indexOf(s) < 0 && upper.indexOf(s) < 0) result.push(s);
  }
  return result;
}

function roundNearZero(point) {
  if (Math.abs(point.x) < EPS) point.x = 0;
  if (Math.abs(point.y) < EPS) point.y = 0;
}