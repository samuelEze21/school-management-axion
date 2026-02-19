const slugify = (text) => {
    const from = 'ãàáäâẽèéëêìíïîõòóöôùúüûñç·/_,:;';
    const to = 'aaaaaeeeeeiiiiooooouuuunc------';
    const newText = text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/&/g, '-y-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-');
    return newText;
};

const getDeepValue = (path, obj) => {
    let o = obj;
    const parts = path.split('.');
    for (let i = 0; i < parts.length; i++) {
        o = o && o[parts[i]];
        if (o === undefined || o === null) return null;
    }
    return o;
};

const setDeepValue = ({ path, value, obj, marker = '.' }) => {
    const pfs = path.split(marker);
    let deepRef = obj;
    for (let i = 0; i < pfs.length; i++) {
        if (deepRef[pfs[i]] === undefined || deepRef[pfs[i]] === null) {
            deepRef[pfs[i]] = {};
        }
        if (i === pfs.length - 1) {
            deepRef[pfs[i]] = value;
        } else {
            deepRef = deepRef[pfs[i]];
        }
    }
    return obj;
};

const flattenObject = (ob, marker = '.') => {
    const toReturn = {};
    for (const i in ob) {
        if (!Object.prototype.hasOwnProperty.call(ob, i)) continue;
        if (typeof ob[i] === 'object' && ob[i] !== null) {
            if (Array.isArray(ob[i])) {
                toReturn[i] = ob[i];
            } else {
                const flatObject = flattenObject(ob[i], marker);
                for (const x in flatObject) {
                    if (!Object.prototype.hasOwnProperty.call(flatObject, x)) continue;
                    toReturn[i + marker + x] = flatObject[x];
                }
            }
        } else {
            toReturn[i] = ob[i];
        }
    }
    return toReturn;
};

const arrayToObj = (arr) => {
    const keys = arr.filter((_, index) => index % 2 === 0);
    const values = arr.filter((_, index) => index % 2 !== 0);
    const obj = {};
    keys.forEach((key, index) => { obj[key] = values[index]; });
    return obj;
};

module.exports = {
    slugify,
    getDeepValue,
    setDeepValue,
    flattenObject,
    arrayToObj,
};
