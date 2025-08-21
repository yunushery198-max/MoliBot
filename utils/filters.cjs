const badWords = ["goblok", "anjing", "tolol", "bangsat"];

function applyFilters(text) {
  return badWords.some(w => text.toLowerCase().includes(w));
}

module.exports = { applyFilters };
