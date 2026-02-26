const rooms = new Map();

export function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function createRoom() {
  let code;
  do { code = generateCode(); } while (rooms.has(code));
  rooms.set(code, { strokes: [] });
  return code;
}

export function getRoom(code) {
  return rooms.get(code);
}

export function deleteRoom(code) {
  rooms.delete(code);
}

export function addStroke(code, stroke) {
  const room = rooms.get(code);
  if (room) room.strokes.push(stroke);
}

export function clearStrokes(code) {
  const room = rooms.get(code);
  if (room) room.strokes = [];
}
