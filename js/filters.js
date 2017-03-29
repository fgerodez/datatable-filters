'use strict';

var $ = require('jquery');

/**
 * Filters is a component that manages a list of filter objects inside
 * a datatable header row.
 *
 * This constructor binds listeners to various datatable events.
 *
 * @param {Object} settings object used to create the datatable
 */
var Filters = function (settings) {
    this.settings = settings;
    this.tableAPI = new $.fn.dataTable.Api(settings);
    this.$header = $(this.tableAPI.table().header());
    this.url = this.tableAPI.ajax.url();

    this.options = $.extend({}, this.defaultSettings, this.tableAPI.init().filters);
    $.extend(this, this.updaters[this.options.updater]);

    this.filters = settings.aoColumns.filter(function (param) {
        return param.filter;
    }).map(function (param) {
        var options = $.extend({
            column: param.idx,
            renderColumn: this.tableAPI.column.index('toVisible', param.idx)
        }, param.filter);

        var filter = this.builders[param.filter.type](options);

        filter.initialize();

        this.applyFilter(filter);

        return filter;
    }, this);

    if (this.filters.length > 0) {
        this.tableAPI.on('init', this.onDataTableInit.bind(this));
    }
};

Filters.prototype = {

    /**
     * Array of filter constructor function. Each function
     * takes a setting object as its single parameter
     */
    builders: {},

    /**
     * Array of updater constructor function.
     * Each function takes the filter to update as its single parameter
     */
    updaters: {},

    /**
     * Array of default settings for the Filter object
     */
    defaultSettings: {
        updater: 'none'
    },

    /**
     * Refreshes filters after each ajax request
     *
     * @returns {Filters} The Filters object
     */
    registerAjaxListener: function () {
        this.tableAPI.on('xhr', function () {
            this.tableAPI.one('preDraw', this.refreshFilters.bind(this));
        }.bind(this));

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
     * @returns {Filters} The Filters object
     */
    setupHeaderRow: function () {
        this.$filterHeader = $('<tr class="datatable-filters-header filters"></tr>');

        this.settings.aoColumns.filter(function (column) {
            return column.bVisible;
        })
        .forEach(function () {
            this.$filterHeader.append('<th></th>');
        }, this);

        this.$header.append(this.$filterHeader);

        return this;
    },

    /**
     * Redraws the datatable
     *
     * @returns {Filters} The Filters object
     */
    drawTable: function () {
        this.tableAPI.draw();

        return this;
    },

    /**
     * Retrieves the column data (current filter is ignored)
     *
     * @param {int} col The column index (0 based)
     *
     * @return {jQuery} The unfiltered column rendered data
     */
    getColumnData: function (col) {
        return this.tableAPI.column(col).data().unique();
    },

    /**
     * Retrieves the column filtered data
     *
     * @param {int} col The column index (0 based)
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
     * @returns {Filters} The Filters object
     */
    onDataTableInit: function () {
        this.setupHeaderRow().registerAjaxListener().renderFilters();

        this.tableAPI.on( 'column-visibility.dt', function ( e, settings, column, visible ) {
            // Find the filter associated to the column
            var filter = this.filters.find(function (filter) {
                return filter.column === column;
            });

            // Find the column index into the DOM
            var renderColumn = settings.aoColumns.slice(0, column)
            .reduce(function (acc, column) {
                return column.bVisible ? acc + 1 : acc;
            }, 0);

            if(visible) {
                this.createFilterWrapper(renderColumn);

                if(filter) {
                    // FIX: if a filter was hidden at the startup, so it doesn't have renderColumn setted,
                    // So we need to re-compute it
                    filter.renderColumn = this.tableAPI.column.index('toVisible', filter.column);

                    filter.initialize();
                    this.renderFilter(filter);
                }
            } else {
                if(filter) {
                    filter.remove();
                }

                this.removeFilterWrapper(renderColumn);
            }
        }.bind(this));

        return this;
    },

    /**
     * When a client-side filter changes, applies its new value
     *
     * @param {Event} event The event object
     * @param {Object} params The event params
     *
     * @return {Filters} The Filters object
     */
    onClientFilterChange: function (event, params) {
        this.applyFilter(params.filter)
            .refreshAllFilters(params.filter)
            .drawTable();

        return this;
    },

    /**
     * When a server-side filter changes, builds the new ajax query and refreshes the table
     *
     * @return {Filters} The Filters object
     */
    onServerFilterChange: function () {
        var serverQuery = this.filters.filter(function (filter) {
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
     * @param {BaseFilter} filter The filter object
     *
     * @return {Filters} The Filters object
     */
    applyFilter: function (filter) {
        this.tableAPI.column(filter.column).search(
            filter.getQuery(),
            filter.isRegexMatch()
            , false);

        return this;
    },

    /**
     * @see this.renderFilter
     *
     * @returns {Filters} The Filters object
     */
    renderFilters: function () {
        this.filters.forEach(this.renderFilter, this);

        return this;
    },

    /**
     * Asks a filter to render itself and provides an optional container
     * for filters that need to be rendered inside the datatable header row
     *
     * @param {BaseFilter} filter The filter object
     */
    renderFilter: function (filter) {
        var col = filter.column;
        var $colHeader = $(this.tableAPI.column(col).header());
        var $container = this.$header.find('.datatable-filters-header th:eq(' + filter.renderColumn + ')');

        if (filter.isServerSide()) {
            filter.register(this.onServerFilterChange.bind(this));
        } else {
            filter.register(this.onClientFilterChange.bind(this));
        }

        filter.render($container, $colHeader.html(), this.getColumnData(col));
    },

    /**
     * Refreshes the filters based on the currently displayed data for each column
     *
     * @return {Filters} The Filters object
     */
    refreshFilters: function () {
        this.filters.forEach(function (filter) {
            filter.refresh(this.getColumnData(filter.column));
            this.applyFilter(filter);
        }, this);

        this.drawTable();

        return this;
    },

    /**
     * Create a filter's header cell
     * @param {number} index the index of the cell to create
     * @return {Filters} The Filters object
     */
    createFilterWrapper: function (index) {
        if(index === 0) {
            this.$filterHeader.prepend('<th/>');
        } else {
            this.$filterHeader.find('th:eq(' + (index - 1) + ')')
            .after('<th/>');
        }

        return this;
    },

    /**
     * Remove a filter's header cell
     * @param {number} index the index of the cell to remove
     * @return {Filters} The Filters object
     */
    removeFilterWrapper: function (index) {
        this.$filterHeader.find('th:eq(' + index + ')').remove();

        return this;
    }
};

$(document).on('preInit.dt', function (e, settings) {
    new Filters(settings);
});

module.exports = Filters;
