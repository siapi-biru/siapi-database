'use strict';

const checkDuplicatedTableNames = require('./check-duplicated-table-names');
const checkReservedNames = require('./check-reserved-names');

const validateModelSchemas = ({ siapi, manager }) => {
  checkDuplicatedTableNames({ siapi, manager });
  checkReservedNames({ siapi, manager });
};

module.exports = {
  validateModelSchemas,
};
