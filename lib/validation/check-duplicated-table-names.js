'use strict';

const _ = require('lodash');

const createErrorMessage = (
  modelA,
  modelB
) => `Duplicated collection name: \`${modelA.model.collectionName}\`.
The same collection name can't be used for two different models.
First found in ${modelA.origin} \`${modelA.apiOrPluginName}\`, model \`${modelA.modelName}\`.
Second found in ${modelB.origin} \`${modelB.apiOrPluginName}\`, model \`${modelB.modelName}\`.`;

// Check if all collection names are unique
const checkDuplicatedTableNames = ({ siapi }) => {
  const modelsWithInfo = [];
  _.forIn(siapi.admin.models, (model, modelName) => {
    modelsWithInfo.push({
      origin: 'Siapi internal',
      model,
      apiOrPluginName: 'admin',
      modelName,
    });
  });

  _.forIn(siapi.api, (api, apiName) => {
    _.forIn(api.models, (model, modelName) => {
      modelsWithInfo.push({
        origin: 'API',
        model,
        apiOrPluginName: apiName,
        modelName,
      });
    });
  });

  _.forIn(siapi.plugins, (plugin, pluginName) => {
    _.forIn(plugin.models, (model, modelName) => {
      modelsWithInfo.push({
        origin: 'Plugin',
        model,
        apiOrPluginName: pluginName,
        modelName,
      });
    });
  });

  modelsWithInfo.forEach(modelA => {
    const similarModelFound = modelsWithInfo.find(
      modelB =>
        modelB.model.collectionName === modelA.model.collectionName &&
        modelB.model.uid !== modelA.model.uid
    );

    if (similarModelFound) {
      throw new Error(createErrorMessage(modelA, similarModelFound));
    }
  });
};

module.exports = checkDuplicatedTableNames;
