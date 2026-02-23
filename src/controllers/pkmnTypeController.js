const { listTypes } = require("../services/pkmnTypeService");

function getTypes(req, res) {
  const types = listTypes();
  return res.status(200).json({
    data: types,
    count: types.length
  });
}

module.exports = { getTypes };