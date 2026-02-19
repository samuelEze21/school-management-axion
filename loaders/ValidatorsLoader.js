const fs = require('fs');
const path = require('path');

/**
 * ValidatorsLoader - builds validators from schema.models and entity schemas (createUser, login, etc.).
 */
module.exports = class ValidatorsLoader {
    constructor({ models = {}, customValidators = {} } = {}) {
        this.models = models;
        this.customValidators = customValidators;
    }

    _get(obj, pathKey) {
        const parts = pathKey.split('.');
        let v = obj;
        for (const p of parts) v = v && v[p];
        return v;
    }

    _validateField(value, def, key) {
        if (def.required && (value === undefined || value === null || value === '')) return `${key} required`;
        if (value === undefined || value === null) return null;
        if (def.custom && this.customValidators[def.custom]) {
            if (!this.customValidators[def.custom](value)) return `${key} invalid`;
            return null;
        }
        if (def.type === 'string' || (def.length && typeof value !== 'string')) {
            if (typeof value !== 'string') return `${key} must be string`;
            const { min, max } = def.length || {};
            if (min != null && value.length < min) return `${key} too short`;
            if (max != null && value.length > max) return `${key} too long`;
        }
        if (def.type === 'number' && typeof value !== 'number') return `${key} must be number`;
        return null;
    }

    _buildValidator(rules) {
        const self = this;
        return function validate(data) {
            const errors = [];
            for (const rule of rules) {
                const modelName = rule.model;
                const def = self.models[modelName];
                if (!def) continue;
                const pathKey = (def && def.path !== undefined ? def.path : modelName);
                const value = self._get(data, pathKey);
                if (rule.required && (value === undefined || value === null || value === '')) {
                    errors.push(`${modelName} required`);
                    continue;
                }
                if (value === undefined || value === null) continue;
                const err = self._validateField(value, def, modelName);
                if (err) errors.push(err);
            }
            return errors.length ? errors : null;
        };
    }

    load() {
        const validators = {};
        const entitiesDir = path.join(__dirname, '../managers/entities');
        if (!fs.existsSync(entitiesDir)) return validators;
        const entityDirs = fs.readdirSync(entitiesDir, { withFileTypes: true }).filter((d) => d.isDirectory());
        for (const dir of entityDirs) {
            const entityName = dir.name;
            const schemaPath = path.join(entitiesDir, entityName, `${entityName}.schema.js`);
            const altPath = path.join(entitiesDir, entityName, 'schema.js');
            const file = fs.existsSync(schemaPath) ? schemaPath : (fs.existsSync(altPath) ? altPath : null);
            if (!file) continue;
            const schema = require(file);
            validators[entityName] = {};
            for (const [method, rules] of Object.entries(schema)) {
                if (Array.isArray(rules)) validators[entityName][method] = this._buildValidator(rules);
            }
        }
        return validators;
    }
};
