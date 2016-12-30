'use strict';

var $ = require('jquery');
var Filters = require('../filters');
var BaseSelect = require('./baseselect');

var SimpleSelectFilter = $.extend({}, BaseSelect.SelectFilter, {

    /**
     * Creates a simple select
     *
     * @returns {SimpleSelectFilter} The Filter object
     */
    init: function () {
        this.$dom = $('<select class="filtre"/>');
        this.$dom.on('change', this._onChange.bind(this));

        return this;
    },

    /**
     * Adds all options without specifying the 'selected' flag
     * If an option with `getInitialQuery` value exists, selects it,
     * otherwise, the first option is selected by default
     *
     * @param {Array<String>} data The column data
     *
     * @returns {SimpleSelectFilter} The filter object
     */
    populate: function (data) {
        this._addOptions(data, this._refreshOption);
        this.$dom.find('option[value="' + this.getInitialQuery() + '"]').attr('selected', 'selected');
        this._saveSelection();
        this._onChange();

        return this;
    },

    /**
     * Refresh the options based on the filter state
     *
     * @param {Array<String>} data The column data
     *
     * @returns {SimpleSelectFilter} The filter object
     */
    update: function (data) {
        this._addOptions(data, this._refreshOption);

        return this;
    },

    /**
     * This filter is dynamic, it can't be used for initial filtering
     *
     * @returns {String} The filter's initial query
     */
    getInitialQuery: function() {
        return '';
    }
});

Filters.prototype.builders.select = BaseSelect.builder.bind(SimpleSelectFilter);

module.exports = SimpleSelectFilter;
