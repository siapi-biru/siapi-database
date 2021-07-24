'use strict';

const _ = require('lodash');

const { createQuery } = require('./queries');
const createConnectorRegistry = require('./connector-registry');
const constants = require('./constants');
const { validateModelSchemas } = require('./validation');
const createMigrationManager = require('./migration-manager');
const createLifecycleManager = require('./lifecycle-manager');

class DatabaseManager {
  constructor(siapi) {
    this.siapi = siapi;

    this.initialized = false;

    this.connectors = createConnectorRegistry({
      connections: siapi.config.get('database.connections'),
      defaultConnection: siapi.config.get('database.defaultConnection'),
    });

    this.queries = new Map();
    this.models = new Map();

    this.migrations = createMigrationManager(this);
    this.lifecycles = createLifecycleManager();
  }

  async initialize() {
    if (this.initialized === true) {
      throw new Error('Database manager already initialized');
    }

    this.initialized = true;

    this.connectors.load();

    validateModelSchemas({ siapi: this.siapi, manager: this });

    this.initializeModelsMap();

    await this.connectors.initialize();

    return this;
  }

  async destroy() {
    await Promise.all(this.connectors.getAll().map(connector => connector.destroy()));
  }

  initializeModelsMap() {
    Object.keys(this.siapi.models).forEach(modelKey => {
      const model = this.siapi.models[modelKey];
      this.models.set(model.uid, model);
    });

    Object.keys(this.siapi.admin.models).forEach(modelKey => {
      const model = this.siapi.admin.models[modelKey];
      this.models.set(model.uid, model);
    });

    Object.keys(this.siapi.plugins).forEach(pluginKey => {
      Object.keys(this.siapi.plugins[pluginKey].models).forEach(modelKey => {
        const model = this.siapi.plugins[pluginKey].models[modelKey];
        this.models.set(model.uid, model);
      });
    });
  }

  query(entity, plugin) {
    if (!entity) {
      throw new Error(`argument entity is required`);
    }

    const model = this.getModel(entity, plugin);

    if (!model) {
      throw new Error(`The model ${entity} can't be found.`);
    }

    if (this.queries.has(model.uid)) {
      return this.queries.get(model.uid);
    }

    const connectorQuery = this.connectors
      .get(model.orm)
      .queries({ model, modelKey: model.modelName, siapi });

    const query = createQuery({
      connectorQuery,
      model,
    });

    this.queries.set(model.uid, query);
    return query;
  }

  getModelFromSiapi(name, plugin) {
    const key = _.toLower(name);
    if (plugin === 'admin') {
      return _.get(siapi.admin, ['models', key]);
    }

    if (plugin) {
      return _.get(siapi.plugins, [plugin, 'models', key]);
    }

    return _.get(siapi, ['models', key]) || _.get(siapi, ['components', key]);
  }

  getModel(name, plugin) {
    const key = _.toLower(name);

    if (this.models.has(key)) {
      const { modelName, plugin: pluginName } = this.models.get(key);
      return this.getModelFromSiapi(modelName, pluginName);
    } else {
      return this.getModelFromSiapi(key, plugin);
    }
  }

  getModelByAssoc(assoc) {
    return this.getModel(assoc.collection || assoc.model, assoc.plugin);
  }

  getModelByCollectionName(collectionName) {
    return Array.from(this.models.values()).find(model => {
      return model.collectionName === collectionName;
    });
  }

  getModelByGlobalId(globalId) {
    return Array.from(this.models.values()).find(model => {
      return model.globalId === globalId;
    });
  }

  getModelsByAttribute(attr) {
    if (attr.type === 'component') {
      return [this.getModel(attr.component)];
    }
    if (attr.type === 'dynamiczone') {
      return attr.components.map(compoName => this.getModel(compoName));
    }
    if (attr.model || attr.collection) {
      return [this.getModelByAssoc(attr)];
    }

    return [];
  }

  getModelsByPluginName(pluginName) {
    if (!pluginName) {
      return siapi.models;
    }

    return pluginName === 'admin' ? siapi.admin.models : siapi.plugins[pluginName].models;
  }

  getReservedNames() {
    return {
      models: constants.RESERVED_MODEL_NAMES,
      attributes: [
        ...constants.RESERVED_ATTRIBUTE_NAMES,
        ...(siapi.db.connectors.default.defaultTimestamps || []),
      ],
    };
  }
}

function createDatabaseManager(siapi) {
  return new DatabaseManager(siapi);
}

module.exports = {
  createDatabaseManager,
};
