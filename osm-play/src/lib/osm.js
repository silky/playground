import postData from './postData';

const highwayTags = [
  'motorway',
  'motorway_link',
  'trunk',
  'trunk_link',
  'primary',
  'primary_link',
  'secondary',
  'secondary_link',
  'tertiary',
  'tertiary_link',
  'unclassified',
  'unclassified_link',
  'residential',
  'residential_link',
  'service',
  'service_link',
  'living_street',
  'pedestrian',
  'road'
].join('|');

export function getAreasAround(lonLat, bounds) {
  var sw = bounds.getSouthWest();
  var ne = bounds.getNorthEast()
  return postData(
    `[timeout:10][out:json];
is_in(${lonLat.lat}, ${lonLat.lng})->.a;
way(pivot.a);
out tags bb;
out ids geom(${sw.lat},${sw.lng},${ne.lat},${ne.lng});
relation(pivot.a);
out tags bb;`
  );
}

export function getRelationBoundary(relId) {
  return postData(`[timeout:10][out:json];
rel(${relId});
(
  way(r);
  node(w);
);
out skel;`).then(response => {
  var nodes = new Map();
  var ways = [];
  response.elements.forEach(el => {
    if (el.type === 'node') {
      nodes.set(el.id, el);
    } else if (el.type === 'way') {
      ways.push(el);
    }
  });
  return {
    nodes, ways
  }
})
}

export function getRoadsInBoundingBox(bounds) {
  var sw = bounds.getSouthWest();
  var ne = bounds.getNorthEast()
  var bbox = `${sw.lat},${sw.lng},${ne.lat},${ne.lng}`;
  // TODO: also try
 // way["waterway"](${bbox});
 //way["highway"~"${highwayTags}"](${bbox});
  return postData(
    `[timeout:9000][maxsize:2000000000][out:json];
(
 way["highway"](${bbox});
 node(w);
);
out skel;`);
}

export function getRoadsInRelationship(relId) {
  return postData(
  `[timeout:9000][maxsize:2000000000][out:json];
rel(${relId});
map_to_area->.a;
(
 way["waterway"](area.a);
 node(w);
);
out skel;`);
}