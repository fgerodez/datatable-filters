'use strict';

var $ = require('jquery');

/**
 * BaseFilter
 *
 * Common interface for datatable filters
 *
 */
var BaseFilter = $.extend({}, {

    column: 0,

    /**
     * The filter root dom node
     * @type {jQuery}
     */
    $dom: undefined,

    /**
     * Main entry point for filter rendering. This method is called once for
     * every filter managed by the Filters object.
     *
     * @param $container {jQuery} The datatable header dom node inside which the filter can be rendered
     * @param header {String} The column header text
     * @param data {Array<String>} The complete (unfiltered) column data
     */
    render: function ($container, header, data) {
        this.showFilter(this.$dom, $container, header);
    },

    /**
     * This method contains the logic used to actually display the filter on the page. By default
     * the filter widget is simply added to the datatable header row.
     *
     * @param $dom {jQuery} The filter widget's root dom node
     * @param $container {jQuery} The datatable header dom node inside which the filter can be rendered
     * @param header {String} The column header text
     */
    showFilter: function ($dom, $container, header) {
        $container.append($dom);
    },

    /**
     * @returns {Boolean} Whether a filter change must trigger a datatable reload.
     * Default is false (client side filter).
     */
    isServerSide: function () {
        return false;
    },

    /**
     * @returns {Boolean} Whether the datatable search must be performed as a regex. It
     * can be overridden for specific behaviour. Default is false.
     */
    isRegexMatch: function () {
        return false;
    },

    /**
     * @returns {Number} The column index associated with the filter (0 based)
     */
    getColumn: function () {
        return this.column;
    },

    /**
     * @returns {String} The filter string to be applied to the datatable column
     */
    getQuery: function () {
        return '';
    },

    /**
     * @returns {String} The filter string to be applied before the datatable is
     * done initializing. It can be useful to prefilter data base on fixed filters.
     * Default behavior is the same as getQuery.
     */
    getInitialQuery: function() {
        return this.getQuery();
    },

    /**
     * @returns {String} The request parameter associated with this filter (in the form key=param,
     * only used for server side filters)
     */
    getServerQuery: function () {
        return '';
    },

    /**
     * @returns {jQuery} The filter root dom node
     */
    getFilterDOM: function () {
        return this.$dom;
    },

    /**
     * @returns {BaseFilter}
     */
    notifyChange: function () {
        this.getFilterDOM().trigger('update.filters.dt', {
            filter: this
        });

        return this;
    },

    /**
     * Action called to refresh the filter content when the datatable content changes.
     * Default implementation is to do nothing (ie. input filters)
     */
    refresh: function () {

    }
});

module.exports = BaseFilter;