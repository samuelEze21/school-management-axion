/** Custom validators keyed by name (referenced in schema.models custom: 'username' etc.) */
module.exports = {
    username: (value) => {
        if (typeof value !== 'string') return false;
        return /^[a-zA-Z0-9_-]+$/.test(value) && value.length >= 3 && value.length <= 20;
    },
};
