'use strict';

var $ = require('jquery');
var Filters = require('../filters');

/**
 * Dummy updater
 */
var UpdateNone = {
    refreshAllFilters: function (filter) {
        return this;
    }
}

Filters.prototype.updaters.none = UpdateNone;
