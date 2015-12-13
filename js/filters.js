'use strict';

var $ = require('jquery');
require('datatables.net')(window, $);

/**
 * Filters is a component that manages a list of filters object inside
 * a datatable header row.
 *
 * This constructor binds listeners to various datatable events.
 *
 * @param settings {Object} settings object used to create the datatable
 */
var Filters = function (settings) {
    this.tableAPI = new $.fn.dataTable.Api(settings);
    this.$header = $(this.tableAPI.table().header());
    this.url = this.tableAPI.ajax.url();

    var filters = [];
    var builders = this.builders;
    $.each(settings.aoColumns, function (col, param) {
        if (param.filter) {
            var options = $.extend({column: col}, param.filter.options);
            filters.push(builders[param.filter.type](options));
        }
    });

    this.filters = filters;
    this.filters.forEach(function (filter) {
        filter.init();
    });
    this.filters.forEach(this.applyInitialFilter, this);

    this.tableAPI.on('init', this.onDataTableInit.bind(this));
};

$.extend(Filters.prototype, {

    builders: {},

    /**
     * Table header dom node
     * @type {jQuery}
     */
    $header: null,

    /**
     * Filters array
     * @type {Array<BaseFilter>}
     */
    filters: [],

    /**
     * Table initial ajax URL
     * @type {String}
     */
    url: '',

    /**
     * Refreshes filters after each ajax request
     *
     * @returns {Filters}
     */
    registerAjaxListener: function () {
        this.tableAPI.on('xhr', $.proxy(function () {
            this.tableAPI.one('preDraw', $.proxy(this.refreshFilters, this));
        }, this));

        return this;
    },

    /**
     * Initializes the header HTML elements that will be used to hold the filters.
     * It also registers the main event handler that will react to the filters'
     * value changes.
     *
     * The event name is <b>filterChange</b>. This event must be triggered by the
     * filters when their value is modified by the user (or any other event that
     * should trigger a datatable filter).
     *
     * @returns {Filters}
     */
    setupHeaderRow: function () {
        var $filterHeader = $('<tr class="filters"></tr>');

        this.tableAPI.columns(':visible').header().each(function () {
            $filterHeader.append('<th class="fond-header"></th>');
        });

        this.$header.append($filterHeader);

        return this;
    },

    /**
     * Redraws the datatable
     *
     * @returns {Filters}
     */
    drawTable: function () {
        this.tableAPI.draw();

        return this;
    },

    /**
     * Retrieves the column data (current filter is ignored)
     *
     * @param col {int} The column index (0 based)
     *
     * @return {jQuery} The unfiltered column data
     */
    getColumnData: function (col) {
        return this.tableAPI.column(col).data().unique();
    },

    /**
     * Retrieves the column filtered data
     *
     * @param col {int} The column index (0 based)
     *
     * @return {jQuery} The filtered column data
     */
    getFilteredColumnData: function (col) {
        return this.tableAPI.column(col, {search: 'applied'}).data().unique();
    },

    /**
     * Actions to execute when the datatable is done initializing.
     * Creates the filter header row, registers ajax listeners and
     * renders filters
     *
     * @returns {Filters}
     */
    onDataTableInit: function () {
        this.setupHeaderRow().registerAjaxListener().renderFilters();

        return this;
    },

    /**
     * When a client-side filter changes, applies its new value
     *
     * @param event {Event} event object
     * @param params {Object} event params
     *
     * @return {Filters}
     */
    onClientFilterChange: function (event, params) {
        this.applyFilter(params.filter).drawTable();

        return this;
    },

    /**
     * When a server-side filter changes, builds the new ajax query and refreshes the table
     *
     * @return {Filters}
     */
    onServerFilterChange: function () {
        var serverQuery = $.grep(this.filters, function (filter) {
            return filter.isServerSide();
        }).map(function (filter) {
            return filter.getServerQuery();
        }).join('&');

        this.tableAPI.ajax.url(this.url + '?' + serverQuery).ajax.reload();

        return this;
    },

    /**
     * Applies the filter value to the related column
     *
     * @param filter The filter object
     *
     * @return {Filters}
     */
    applyFilter: function (filter) {
        this.tableAPI.column(filter.column).search(
            filter.getQuery(),
            filter.isRegexMatch()
            , false);

        return this;
    },

    /**
     *
     * @param filter
     * @returns {Filters}
     */
    applyInitialFilter: function (filter) {
        this.tableAPI.column(filter.column).search(
            filter.getInitialQuery(),
            filter.isRegexMatch()
            , false);

        return this;
    },

    /**
     * @see this.renderFilter
     *
     * @returns {Filters}
     */
    renderFilters: function () {
        this.filters.forEach(this.renderFilter, this);

        return this;
    },

    /**
     * Asks a filter to render itself and provides an optional container
     * for filters that need to be rendered inside the datatable header row
     *
     * @param filter The filter object
     */
    renderFilter: function (filter) {
        var col = filter.column;
        var $colHeader = $(this.tableAPI.column(col).header());
        var $container = this.$header.find('.fond-header:eq(' + col + ')');

        if (filter.isServerSide()) {
            filter.register($.proxy(this.onServerFilterChange, this));
        } else {
            filter.register($.proxy(this.onClientFilterChange, this));
        }

        filter.render($container, $colHeader.html(), this.getColumnData(col));
    },

    /**
     * Refreshes the filters based on the currently displayed data for each column
     *
     * @return {Filters}
     */
    refreshFilters: function () {
        this.filters.forEach(function (filter) {
            filter.refresh(this.getColumnData(filter.column));
        }, this);

        return this;
    }
});

$(document).on('preInit.dt', function (e, settings) {
    new Filters(settings);
});

module.exports = Filters;