'use strict';

var $ = require('jquery');
var SelectFilter = require('./selectfilter');

var REGEX_FALSE = '$^';

/**
 * MultiSelectFilter
 *
 * Configurable select filter. It can be dynamic (based on the column's data) or
 * fixed (based on a supplied DOM select). It can be single or multivalued
 *
 */
var MultiSelectFilter = function (config) {
    SelectFilter.call(this, config);
};

$.extend(MultiSelectFilter.prototype, SelectFilter.prototype, {

    /**
     * If the current filter is fixed (config.src is set), the select tag is
     * fetched with its selector. Otherwise a new select is created
     *
     * @returns {jQuery} The filter's select object
     */
    _createSelect: function () {
        if (this.src) {
            return $(this.src);
        }

        return $('<select class="filtre"/>').attr('multiple', 'multiple');
    },

    _getSelection: function () {
        return this.$dom.find('option:selected').toArray();
    },

    /**
     * Populates the select's data. The select is first emptied before being
     * populated with the new options.
     *
     * @param data {jQuery} The data to add to the select
     */
    _addOptions: function (data) {
        this.$dom.empty();

        if (this.allText)
            this._addOption(this.allText);

        data.toArray().filter(this.filterOptions).sort(this.sortOptions).forEach(this._addOption, this);
    },

    _addOption: function (value) {
        this.$dom.append($('<option/>')
            .val(value)
            .text(value)
            .attr('selected', 'selected')
        );
    },

    _getSelectedQuery: function () {
        return this.selected.map(function (option) {
            if (option.value == this.allText) {
                return '';
            } else {
                return '^' + $.fn.dataTable.util.escapeRegex(option.value) + '$';
            }
        }, this).join('|');
    },

    /**
     * @returns {String} The datatable column query text to apply. It can be overridden for
     * specific behavior. Default is to escape regex and concatenate the values
     * with a pipe character
     */
    getQuery: function () {
        if (this.selected.length == 0)
            return REGEX_FALSE;

        return this._getSelectedQuery();
    },

    getInitialQuery: function () {
        if (this.src && this.selected.length == 0)
            return REGEX_FALSE;

        return this._getSelectedQuery();
    }
});

module.exports = MultiSelectFilter;