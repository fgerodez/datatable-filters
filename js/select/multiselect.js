'use strict';

var $ = require('jquery');
var Filters = require('../filters');
var BaseSelect = require('./baseselect');

var MultiSelectFilter = $.extend({}, BaseSelect.SelectFilter, {

    /**
     * Initializes a multiselect dom object
     *
     * @returns {MultiSelectFilter} The Filter object
     */
    init: function () {
        this.$dom = $('<select class="filtre"/>').attr('multiple', 'multiple');
        this.$dom.on('change', this._onChange.bind(this));

        return this;
    },

    /**
     * Populates the multiselect with 'selected' options by default
     * Uses getInitialQuery as default value(s)
     *
     * @param {Array<String>} data The column data
     *
     * @returns {MultiSelectFilter} The Filter object
     */
    populate: function (data) {
        this._addOptions(data, this._addSelectedOption);

        // Select each values returned by getInitialQuery
        var initialQuery = this.getInitialQuery();

        if (Array.isArray(initialQuery)) {
            initialQuery.forEach(function (initialQuery) {
                this.$dom.find('option[value="' + initialQuery + '"]').attr('selected', 'selected');
            }.bind(this));
        } else { // Assume initial query is a string
            this.$dom.find('option[value="' + initialQuery + '"]').attr('selected', 'selected');
        }

        this._saveSelection();
        this._onChange();

        return this;
    },

    /**
     * If the 'all' option is selected, sets the new options as 'selected'.
     * Otherwise, adds the options based on the filter state
     *
     * @param {Array<String>} data The column data
     *
     * @returns {MultiSelectFilter} The Filter object
     */
    update: function (data) {
        if ($.inArray(this.allText, this.selected) > -1 || this._getNotSelected().length == 0)
            this._addOptions(data, this._addSelectedOption);
        else
            this._addOptions(data, this._refreshOption);

        return this;
    },

    /**
     * This filter is dynamic, it can't be used for initial filtering
     *
     * @returns {String} The filter initial query
     */
    getInitialQuery: function () {
        return '';
    }
});

Filters.prototype.builders.multiselect = BaseSelect.builder.bind(MultiSelectFilter);

module.exports = MultiSelectFilter;
