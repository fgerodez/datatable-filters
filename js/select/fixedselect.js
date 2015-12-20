'use strict';

var $ = require('jquery');
var Filters = require('../filters');
var SelectFilter = require('./baseselect');
var SimpleRenderer = require('../renderer/simple');
var BootstrapRenderer = require('./renderer/bootstrap');

var FixedSelectFilter = $.extend({}, SelectFilter, {

    /**
     * Simply saves a handle on the provided source select
     *
     * @returns {FixedSelectFilter}
     */
    init: function () {
        this.$dom = $(this.src);
        this.$dom.on('change', this.notifyChange.bind(this));

        return this;
    },

    /**
     * No action for fixed filters: the provided select is used as is
     *
     * @returns {FixedSelectFilter}
     */
    populate: function () {
        return this;
    },

    /**
     * No update for fixed filters: the provided select is never changed
     *
     * @returns {FixedSelectFilter}
     */
    update: function () {
        return this;
    },

    /**
     * Fixed filters can be used to provide initial filters to apply to the
     * datatable.
     *
     * @returns {*|String}
     */
    getInitialQuery: function() {
        return this.getQuery();
    }
});

Filters.prototype.builders.fixedselect = function(settings) {
    return $.extend({}, FixedSelectFilter, SimpleRenderer, settings);
};

Filters.prototype.builders.fixedselectBootstrap = function(settings) {
    return $.extend({}, FixedSelectFilter, BootstrapRenderer, settings);
};

module.exports = FixedSelectFilter;