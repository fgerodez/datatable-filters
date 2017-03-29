(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

/**
 * BaseFilter
 */
var BaseFilter = {

    initialize: function () {
        this.init();

        if (this.className) {
            this.addClass(this.className);
        }

        if (this.attrs) {
            this.addAttributes(this.attrs);
        }
    },

    /**
     * @returns {Boolean} Whether a filter change must trigger a datatable reload.
     * Default is false (client side filter).
     */
    isServerSide: function () {
        return false;
    },

    /**
     * @returns {String} The request parameter associated with this filter (in the form key=param,
     * only used for server side filters)
     */
    getServerQuery: function () {
        return '';
    },

    /**
     * Triggers an update event
     *
     * @returns {BaseFilter} The filter object
     */
    notifyChange: function () {
        this.$dom.trigger('update.filters.dt', {
            filter: this
        });

        return this;
    },

    /**
     * @returns {String} The filter string to be applied to the datatable column
     */
    getQuery: function () {
        if (!this.hasValue()) {
            return this.noSelectionQuery();
        }

        return this.selectedQuery();
    },

    /**
     * Registers a callback to be called when the value of the filter changes
     *
     * @param {Function} callback The action to perform when the filter value changes
     *
     * @returns {BaseFilter} The filter object
     */
    register: function (callback) {
        this.$dom.on('update.filters.dt', callback);

        return this;
    },

    /**
     * Adds a css class to the filter component
     *
     * @param {String} cssClass The css class to add
     *
     * @returns {BaseFilter} The filter object
     */
    addClass: function (cssClass) {
        this.$dom.addClass(cssClass);

        return this;
    },

    /**
     * Sets the given values as attributes of the filter component
     *
     * @param {Array} attrs An object of attribute-value pairs to set
     *
     * @returns {BaseFilter} The filter object
     */
    addAttributes: function (attrs) {
        this.$dom.attr(attrs);

        return this;
    },

    /**
     * Remove the filter from the DOM.
     * Reset the filter's value before removing to disable filtering for this column.
     */
    remove: function () {
        this.reset();
        this.notifyChange();

        this.$dom.remove();
        delete this.$dom;
    }
};

module.exports = BaseFilter;

},{}],2:[function(require,module,exports){
(function (global){
'use strict';

var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null);

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

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],3:[function(require,module,exports){
(function (global){
'use strict';

var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null);
var BaseFilter = require('../basefilter');
var SimpleRenderer = require('../renderer/simple');
var Filters = require('../filters');

var InputFilter = $.extend({}, BaseFilter, SimpleRenderer, {

    init: function () {
        this.$dom = $('<input class="filtre"/>');
        this.$dom.val(this.getInitialQuery());
        this.$dom.on('input', this.notifyChange.bind(this));

        return this;
    },

    populate: function () {
        return this;
    },

    update: function () {
        return this;
    },

    noSelectionQuery: function () {
        return '';
    },

    isRegexMatch: function () {
        return true;
    },

    hasValue: function () {
        return this.$dom.val() != '';
    },

    selectedQuery: function () {
        return this.$dom.val();
    },

    getInitialQuery: function () {
        return '';
    },

    /**
      * Reset the filter's input,
      * so the filter will keep every rows
      * @returns {InputFilter} The Filter object
      */
    reset: function () {
        this.$dom.val('');

        return this;
    }

});

Filters.prototype.builders.input = function (settings) {
    return $.extend({}, InputFilter, settings);
};

module.exports = InputFilter;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../basefilter":1,"../filters":2,"../renderer/simple":5}],4:[function(require,module,exports){
'use strict';

require('./updater/updateNone');
require('./updater/updateOthers');
require('./select/simpleselect');
require('./select/multiselect');
require('./select/fixedselect');
require('./input/input');
require('./filters');

},{"./filters":2,"./input/input":3,"./select/fixedselect":7,"./select/multiselect":8,"./select/simpleselect":11,"./updater/updateNone":12,"./updater/updateOthers":13}],5:[function(require,module,exports){
'use strict';

var SimpleRenderer = {
    render: function ($container, header, data) {
        this.populate(data);
        this.showFilter(this.$dom, $container, header, data);

        return this;
    },

    showFilter: function($dom, $container, header) {
        $container.append(this.$dom);
        this.$dom.attr('name', header).attr('placeholder', header).show();
    },

    refresh: function (data) {
        this.update(data);

        return this;
    }
};

module.exports = SimpleRenderer;
},{}],6:[function(require,module,exports){
(function (global){
'use strict';

var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null);
var BaseFilter = require('../basefilter');
var SimpleRenderer = require('../renderer/simple');
var BootstrapRenderer = require('./renderer/bootstrap');
var ChosenRender = require('./renderer/chosen');

/**
 * SelectFilter regroups common behavior for select filters
 */
var SelectFilter = $.extend({}, BaseFilter, {
    selected: [],

    /**
     * @returns {string} Returns an always false regex to hide every records
     * when no option is selected
     */
    noSelectionQuery: function () {
        return '$.^';
    },

    /**
     * @returns {boolean} True. Select filters always use regex
     */
    isRegexMatch: function () {
        return true;
    },

    /**
     * @returns {boolean} Returns true if at least one option is selected
     */
    hasValue: function () {
        return this._getSelection().length > 0;
    },

    /**
     * @returns {String} The column filter query to apply. Selected option values
     * are concatenated into a string using the pipe character (regex or)
     */
    selectedQuery: function () {
        return this._getSelection().map(function (value) {
            if (value == this.allText || this._getNotSelected().length === 0) {
                return '';
            } else {
                return '^' + $.fn.dataTable.util.escapeRegex(value) + '$';
            }
        }, this).join('|');
    },

    /**
     * Filters the options before adding them to the select. Can be overridden
     * for specific filtering.
     * By default, use the value as option if `value` if a non empty string.
     *
     * @param {String} value The option value
     *
     * @returns {Boolean} True if the value can be included in the filter options. False otherwise.
     */
    filterOptions: function (value) {
        return value && value.trim() != '';
    },

    /**
      * Reset the filter by select none option,
      * so the filter will keep every rows
      * @returns {SelectFilter} The Filter object
      */
    reset: function () {
        this.$dom.find('option').removeAttr('selected');
        this._saveSelection();

        return this;
    },

    /**
     * Sort the options before adding them to the select. Can be overridden for
     * specific sorts
     *
     * @param {String} a The first value to compare
     * @param {String} b The second value to compare
     *
     * @return {Integer} 0 if the two values are equal, 1 if a > b and -1 if a < b
     */
    sortOptions: function (a, b) {
        if (a > b) {
            return 1;
        }

        if (a < b) {
            return -1;
        }

        return 0;
    },

    /**
     * @returns {Array<String>} The array of selected values
     * @private
     */
    _getSelection: function () {
        return this.$dom.find('option:selected').toArray().map(function (option) {
            return option.value;
        });
    },

    /**
     *
     * @returns {*|Array} The array of non selected values
     * @private
     */
    _getNotSelected: function () {
        return this.$dom.find(':not(option:selected)').toArray().map(function (option) {
            return option.value;
        });
    },

    /**
     * For each element in the data object, creates an option element using the function
     * fnCreate
     *
     * @param {jQuery} data The data to add to the select
     * @param {Function} fnCreate The function to use to create the options
     * @private
     */
    _addOptions: function (data, fnCreate) {
        this.$dom.empty();

        if (this.allText)
            fnCreate.call(this, this.allText);

        data.toArray().filter(this.filterOptions).sort(this.sortOptions).forEach(fnCreate, this);
    },

    /**
     * Creates a selected option
     *
     * @param {String} value The option value
     * @private
     */
    _addSelectedOption: function (value) {
        this.$dom.append($('<option/>')
                .val(value)
                .text(value)
                .attr('selected', 'selected')
        );
    },

    /**
     * Creates an option with the selected flag based on the
     * current filter state
     *
     * @param {String} value The option value
     * @private
     */
    _refreshOption: function (value) {
        var $option = $('<option/>')
            .val(value)
            .text(value);

        if ($.inArray(value, this.selected) > -1)
            $option.attr('selected', 'selected');

        this.$dom.append($option);
    },

    /**
     * Takes a snapshot of the current selection state
     *
     * @private
     */
    _saveSelection: function () {
        this.selected = this._getSelection();
    },

    /**
     * Whenever the select state changes, save its new state and
     * notify the listening component
     *
     * @private
     */
    _onChange: function () {
        this._saveSelection();
        this.notifyChange();
    }
});

var availableRenderers = {
    'bootstrap': BootstrapRenderer,
    'chosen': ChosenRender
};

var builder = function (settings) {
    var renderer = availableRenderers[settings.renderer] || SimpleRenderer;

    return $.extend({}, this, renderer, settings);
};

module.exports = {
    SelectFilter: SelectFilter,
    builder: builder
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../basefilter":1,"../renderer/simple":5,"./renderer/bootstrap":9,"./renderer/chosen":10}],7:[function(require,module,exports){
(function (global){
'use strict';

var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null);
var Filters = require('../filters');
var BaseSelect = require('./baseselect');

var FixedSelectFilter = $.extend({}, BaseSelect.SelectFilter, {

    /**
     * Simply saves a handle on the provided source select
     *
     * @returns {FixedSelectFilter} The select filter
     */
    init: function () {
        this.$dom = $(this.src);
        this.$dom.on('change', this.notifyChange.bind(this));

        return this;
    },

    /**
     * No action for fixed filters: the provided select is used as is
     *
     * @returns {FixedSelectFilter} The Filter object
     */
    populate: function () {
        return this;
    },

    /**
     * No update for fixed filters: the provided select is never changed
     *
     * @returns {FixedSelectFilter} The Filter object
     */
    update: function () {
        return this;
    },

    /**
     * Fixed filters can be used to provide initial filters to apply to the
     * datatable.
     *
     * @returns {String} The Filter query
     */
    getInitialQuery: function() {
        return this.getQuery();
    }
});

Filters.prototype.builders.fixedselect = BaseSelect.builder.bind(FixedSelectFilter);

module.exports = FixedSelectFilter;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../filters":2,"./baseselect":6}],8:[function(require,module,exports){
(function (global){
'use strict';

var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null);
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
        if(initialQuery) {
            this._unselectAllOptions();
            if(Array.isArray(initialQuery)) {
                initialQuery.forEach(this._selectOption.bind(this));
            } else { // Asume initial query is a non empty string
                this._selectOption(initialQuery);
            }
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
    },

    /**
     * remove all selected options
     */
    _unselectAllOptions: function () {
        this.$dom.find('option:selected').prop('selected', false);
    },

    /**
     * find an option by its value, and select it
     * @param {String} value option's value
     */
    _selectOption: function (value) {
        this.$dom.find('option[value="' + value + '"]').prop('selected', true);
    },

    /**
     * Reset the filter by select all options,
     * so the filter will keep every rows
     * @returns {MultiSelectFilter} The Filter object
     */
    reset: function () {
        var allValues = this.$dom.find('option').get().map(function (option) {
            return option.value;
        });
        this.$dom.val(allValues);
        this._saveSelection();

        return this;
    }
});

Filters.prototype.builders.multiselect = BaseSelect.builder.bind(MultiSelectFilter);

module.exports = MultiSelectFilter;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../filters":2,"./baseselect":6}],9:[function(require,module,exports){
(function (global){
'use strict';
var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null);

var BootstrapRenderer = {
    render: function ($container, header, data) {
        this.populate(data);
        this.showFilter(this.$dom, $container, header, data);

        var defaultOptions = {
            buttonText: function (options) {
                var nbSelected = $(options).filter(':selected').length;
                if (nbSelected == 0) {
                    return header;
                }
                return header + ' (' + nbSelected + ')';
            }
        };

        this.$dom.multiselect($.extend(defaultOptions, this.rendererOptions));

        return this;
    },

    showFilter: function ($dom, $container) {
        $container.append(this.$dom);
    },

    refresh: function (data) {
        this.update(data);
        this.$dom.multiselect('rebuild');

        return this;
    }
};

module.exports = BootstrapRenderer;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],10:[function(require,module,exports){
'use strict';

var ChosenRenderer = {
    render: function ($container, header, data) {
        this.populate(data);
        this.showFilter(this.$dom, $container, header, data);
        this.$dom.chosen(this.rendererOptions || {});

        return this;
    },

    showFilter: function($dom, $container) {
        $container.append(this.$dom);
    },

    refresh: function (data) {
        this.update(data);
        this.$dom.trigger('chosen:updated');

        return this;
    }
};

module.exports = ChosenRenderer;
},{}],11:[function(require,module,exports){
(function (global){
'use strict';

var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null);
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

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../filters":2,"./baseselect":6}],12:[function(require,module,exports){
'use strict';

var Filters = require('../filters');

/**
 * Dummy updater
 */
var UpdateNone = {
    refreshAllFilters: function () {
        return this;
    }
};

Filters.prototype.updaters.none = UpdateNone;

},{"../filters":2}],13:[function(require,module,exports){
'use strict';

var Filters = require('../filters');

/**
 * Each time a filter changed,
 * refresh the others filters.
 */
var UpdateOthers = {

    refreshAllFilters: function (filter) {
        // refresh all filters
        // except the changed one,
        // unless the filter is resetted.
        var filtersToRefresh = this.filters
            .filter(function (f) {
                return f.column !== filter.column;
            });


        filtersToRefresh.forEach(function (filter) {
            filter.refresh(this.getFilteredColumnData(filter.column));
        }, this);

        return this;
    }
};

Filters.prototype.updaters.others = UpdateOthers;

},{"../filters":2}]},{},[4])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJqcy9iYXNlZmlsdGVyLmpzIiwianMvZmlsdGVycy5qcyIsImpzL2lucHV0L2lucHV0LmpzIiwianMvbWFpbi5qcyIsImpzL3JlbmRlcmVyL3NpbXBsZS5qcyIsImpzL3NlbGVjdC9iYXNlc2VsZWN0LmpzIiwianMvc2VsZWN0L2ZpeGVkc2VsZWN0LmpzIiwianMvc2VsZWN0L211bHRpc2VsZWN0LmpzIiwianMvc2VsZWN0L3JlbmRlcmVyL2Jvb3RzdHJhcC5qcyIsImpzL3NlbGVjdC9yZW5kZXJlci9jaG9zZW4uanMiLCJqcy9zZWxlY3Qvc2ltcGxlc2VsZWN0LmpzIiwianMvdXBkYXRlci91cGRhdGVOb25lLmpzIiwianMvdXBkYXRlci91cGRhdGVPdGhlcnMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNoSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUN0VEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMvREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDdEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDMU1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDcERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQzVHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNuQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUN2QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBCYXNlRmlsdGVyXG4gKi9cbnZhciBCYXNlRmlsdGVyID0ge1xuXG4gICAgaW5pdGlhbGl6ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLmluaXQoKTtcblxuICAgICAgICBpZiAodGhpcy5jbGFzc05hbWUpIHtcbiAgICAgICAgICAgIHRoaXMuYWRkQ2xhc3ModGhpcy5jbGFzc05hbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuYXR0cnMpIHtcbiAgICAgICAgICAgIHRoaXMuYWRkQXR0cmlidXRlcyh0aGlzLmF0dHJzKTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gV2hldGhlciBhIGZpbHRlciBjaGFuZ2UgbXVzdCB0cmlnZ2VyIGEgZGF0YXRhYmxlIHJlbG9hZC5cbiAgICAgKiBEZWZhdWx0IGlzIGZhbHNlIChjbGllbnQgc2lkZSBmaWx0ZXIpLlxuICAgICAqL1xuICAgIGlzU2VydmVyU2lkZTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSByZXF1ZXN0IHBhcmFtZXRlciBhc3NvY2lhdGVkIHdpdGggdGhpcyBmaWx0ZXIgKGluIHRoZSBmb3JtIGtleT1wYXJhbSxcbiAgICAgKiBvbmx5IHVzZWQgZm9yIHNlcnZlciBzaWRlIGZpbHRlcnMpXG4gICAgICovXG4gICAgZ2V0U2VydmVyUXVlcnk6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuICcnO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBUcmlnZ2VycyBhbiB1cGRhdGUgZXZlbnRcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtCYXNlRmlsdGVyfSBUaGUgZmlsdGVyIG9iamVjdFxuICAgICAqL1xuICAgIG5vdGlmeUNoYW5nZTogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLiRkb20udHJpZ2dlcigndXBkYXRlLmZpbHRlcnMuZHQnLCB7XG4gICAgICAgICAgICBmaWx0ZXI6IHRoaXNcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBmaWx0ZXIgc3RyaW5nIHRvIGJlIGFwcGxpZWQgdG8gdGhlIGRhdGF0YWJsZSBjb2x1bW5cbiAgICAgKi9cbiAgICBnZXRRdWVyeTogZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoIXRoaXMuaGFzVmFsdWUoKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubm9TZWxlY3Rpb25RdWVyeSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuc2VsZWN0ZWRRdWVyeSgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZWdpc3RlcnMgYSBjYWxsYmFjayB0byBiZSBjYWxsZWQgd2hlbiB0aGUgdmFsdWUgb2YgdGhlIGZpbHRlciBjaGFuZ2VzXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgYWN0aW9uIHRvIHBlcmZvcm0gd2hlbiB0aGUgZmlsdGVyIHZhbHVlIGNoYW5nZXNcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtCYXNlRmlsdGVyfSBUaGUgZmlsdGVyIG9iamVjdFxuICAgICAqL1xuICAgIHJlZ2lzdGVyOiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgdGhpcy4kZG9tLm9uKCd1cGRhdGUuZmlsdGVycy5kdCcsIGNhbGxiYWNrKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQWRkcyBhIGNzcyBjbGFzcyB0byB0aGUgZmlsdGVyIGNvbXBvbmVudFxuICAgICAqXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGNzc0NsYXNzIFRoZSBjc3MgY2xhc3MgdG8gYWRkXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7QmFzZUZpbHRlcn0gVGhlIGZpbHRlciBvYmplY3RcbiAgICAgKi9cbiAgICBhZGRDbGFzczogZnVuY3Rpb24gKGNzc0NsYXNzKSB7XG4gICAgICAgIHRoaXMuJGRvbS5hZGRDbGFzcyhjc3NDbGFzcyk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIGdpdmVuIHZhbHVlcyBhcyBhdHRyaWJ1dGVzIG9mIHRoZSBmaWx0ZXIgY29tcG9uZW50XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBhdHRycyBBbiBvYmplY3Qgb2YgYXR0cmlidXRlLXZhbHVlIHBhaXJzIHRvIHNldFxuICAgICAqXG4gICAgICogQHJldHVybnMge0Jhc2VGaWx0ZXJ9IFRoZSBmaWx0ZXIgb2JqZWN0XG4gICAgICovXG4gICAgYWRkQXR0cmlidXRlczogZnVuY3Rpb24gKGF0dHJzKSB7XG4gICAgICAgIHRoaXMuJGRvbS5hdHRyKGF0dHJzKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlIHRoZSBmaWx0ZXIgZnJvbSB0aGUgRE9NLlxuICAgICAqIFJlc2V0IHRoZSBmaWx0ZXIncyB2YWx1ZSBiZWZvcmUgcmVtb3ZpbmcgdG8gZGlzYWJsZSBmaWx0ZXJpbmcgZm9yIHRoaXMgY29sdW1uLlxuICAgICAqL1xuICAgIHJlbW92ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnJlc2V0KCk7XG4gICAgICAgIHRoaXMubm90aWZ5Q2hhbmdlKCk7XG5cbiAgICAgICAgdGhpcy4kZG9tLnJlbW92ZSgpO1xuICAgICAgICBkZWxldGUgdGhpcy4kZG9tO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQmFzZUZpbHRlcjtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snJCddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnJCddIDogbnVsbCk7XG5cbi8qKlxuICogRmlsdGVycyBpcyBhIGNvbXBvbmVudCB0aGF0IG1hbmFnZXMgYSBsaXN0IG9mIGZpbHRlciBvYmplY3RzIGluc2lkZVxuICogYSBkYXRhdGFibGUgaGVhZGVyIHJvdy5cbiAqXG4gKiBUaGlzIGNvbnN0cnVjdG9yIGJpbmRzIGxpc3RlbmVycyB0byB2YXJpb3VzIGRhdGF0YWJsZSBldmVudHMuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHNldHRpbmdzIG9iamVjdCB1c2VkIHRvIGNyZWF0ZSB0aGUgZGF0YXRhYmxlXG4gKi9cbnZhciBGaWx0ZXJzID0gZnVuY3Rpb24gKHNldHRpbmdzKSB7XG4gICAgdGhpcy5zZXR0aW5ncyA9IHNldHRpbmdzO1xuICAgIHRoaXMudGFibGVBUEkgPSBuZXcgJC5mbi5kYXRhVGFibGUuQXBpKHNldHRpbmdzKTtcbiAgICB0aGlzLiRoZWFkZXIgPSAkKHRoaXMudGFibGVBUEkudGFibGUoKS5oZWFkZXIoKSk7XG4gICAgdGhpcy51cmwgPSB0aGlzLnRhYmxlQVBJLmFqYXgudXJsKCk7XG5cbiAgICB0aGlzLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgdGhpcy5kZWZhdWx0U2V0dGluZ3MsIHRoaXMudGFibGVBUEkuaW5pdCgpLmZpbHRlcnMpO1xuICAgICQuZXh0ZW5kKHRoaXMsIHRoaXMudXBkYXRlcnNbdGhpcy5vcHRpb25zLnVwZGF0ZXJdKTtcblxuICAgIHRoaXMuZmlsdGVycyA9IHNldHRpbmdzLmFvQ29sdW1ucy5maWx0ZXIoZnVuY3Rpb24gKHBhcmFtKSB7XG4gICAgICAgIHJldHVybiBwYXJhbS5maWx0ZXI7XG4gICAgfSkubWFwKGZ1bmN0aW9uIChwYXJhbSkge1xuICAgICAgICB2YXIgb3B0aW9ucyA9ICQuZXh0ZW5kKHtcbiAgICAgICAgICAgIGNvbHVtbjogcGFyYW0uaWR4LFxuICAgICAgICAgICAgcmVuZGVyQ29sdW1uOiB0aGlzLnRhYmxlQVBJLmNvbHVtbi5pbmRleCgndG9WaXNpYmxlJywgcGFyYW0uaWR4KVxuICAgICAgICB9LCBwYXJhbS5maWx0ZXIpO1xuXG4gICAgICAgIHZhciBmaWx0ZXIgPSB0aGlzLmJ1aWxkZXJzW3BhcmFtLmZpbHRlci50eXBlXShvcHRpb25zKTtcblxuICAgICAgICBmaWx0ZXIuaW5pdGlhbGl6ZSgpO1xuXG4gICAgICAgIHRoaXMuYXBwbHlGaWx0ZXIoZmlsdGVyKTtcblxuICAgICAgICByZXR1cm4gZmlsdGVyO1xuICAgIH0sIHRoaXMpO1xuXG4gICAgaWYgKHRoaXMuZmlsdGVycy5sZW5ndGggPiAwKSB7XG4gICAgICAgIHRoaXMudGFibGVBUEkub24oJ2luaXQnLCB0aGlzLm9uRGF0YVRhYmxlSW5pdC5iaW5kKHRoaXMpKTtcbiAgICB9XG59O1xuXG5GaWx0ZXJzLnByb3RvdHlwZSA9IHtcblxuICAgIC8qKlxuICAgICAqIEFycmF5IG9mIGZpbHRlciBjb25zdHJ1Y3RvciBmdW5jdGlvbi4gRWFjaCBmdW5jdGlvblxuICAgICAqIHRha2VzIGEgc2V0dGluZyBvYmplY3QgYXMgaXRzIHNpbmdsZSBwYXJhbWV0ZXJcbiAgICAgKi9cbiAgICBidWlsZGVyczoge30sXG5cbiAgICAvKipcbiAgICAgKiBBcnJheSBvZiB1cGRhdGVyIGNvbnN0cnVjdG9yIGZ1bmN0aW9uLlxuICAgICAqIEVhY2ggZnVuY3Rpb24gdGFrZXMgdGhlIGZpbHRlciB0byB1cGRhdGUgYXMgaXRzIHNpbmdsZSBwYXJhbWV0ZXJcbiAgICAgKi9cbiAgICB1cGRhdGVyczoge30sXG5cbiAgICAvKipcbiAgICAgKiBBcnJheSBvZiBkZWZhdWx0IHNldHRpbmdzIGZvciB0aGUgRmlsdGVyIG9iamVjdFxuICAgICAqL1xuICAgIGRlZmF1bHRTZXR0aW5nczoge1xuICAgICAgICB1cGRhdGVyOiAnbm9uZSdcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmVmcmVzaGVzIGZpbHRlcnMgYWZ0ZXIgZWFjaCBhamF4IHJlcXVlc3RcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJzfSBUaGUgRmlsdGVycyBvYmplY3RcbiAgICAgKi9cbiAgICByZWdpc3RlckFqYXhMaXN0ZW5lcjogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnRhYmxlQVBJLm9uKCd4aHInLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLnRhYmxlQVBJLm9uZSgncHJlRHJhdycsIHRoaXMucmVmcmVzaEZpbHRlcnMuYmluZCh0aGlzKSk7XG4gICAgICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEluaXRpYWxpemVzIHRoZSBoZWFkZXIgSFRNTCBlbGVtZW50cyB0aGF0IHdpbGwgYmUgdXNlZCB0byBob2xkIHRoZSBmaWx0ZXJzLlxuICAgICAqIEl0IGFsc28gcmVnaXN0ZXJzIHRoZSBtYWluIGV2ZW50IGhhbmRsZXIgdGhhdCB3aWxsIHJlYWN0IHRvIHRoZSBmaWx0ZXJzJ1xuICAgICAqIHZhbHVlIGNoYW5nZXMuXG4gICAgICpcbiAgICAgKiBUaGUgZXZlbnQgbmFtZSBpcyA8Yj5maWx0ZXJDaGFuZ2U8L2I+LiBUaGlzIGV2ZW50IG11c3QgYmUgdHJpZ2dlcmVkIGJ5IHRoZVxuICAgICAqIGZpbHRlcnMgd2hlbiB0aGVpciB2YWx1ZSBpcyBtb2RpZmllZCBieSB0aGUgdXNlciAob3IgYW55IG90aGVyIGV2ZW50IHRoYXRcbiAgICAgKiBzaG91bGQgdHJpZ2dlciBhIGRhdGF0YWJsZSBmaWx0ZXIpLlxuICAgICAqXG4gICAgICogQHJldHVybnMge0ZpbHRlcnN9IFRoZSBGaWx0ZXJzIG9iamVjdFxuICAgICAqL1xuICAgIHNldHVwSGVhZGVyUm93OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuJGZpbHRlckhlYWRlciA9ICQoJzx0ciBjbGFzcz1cImRhdGF0YWJsZS1maWx0ZXJzLWhlYWRlciBmaWx0ZXJzXCI+PC90cj4nKTtcblxuICAgICAgICB0aGlzLnNldHRpbmdzLmFvQ29sdW1ucy5maWx0ZXIoZnVuY3Rpb24gKGNvbHVtbikge1xuICAgICAgICAgICAgcmV0dXJuIGNvbHVtbi5iVmlzaWJsZTtcbiAgICAgICAgfSlcbiAgICAgICAgLmZvckVhY2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy4kZmlsdGVySGVhZGVyLmFwcGVuZCgnPHRoPjwvdGg+Jyk7XG4gICAgICAgIH0sIHRoaXMpO1xuXG4gICAgICAgIHRoaXMuJGhlYWRlci5hcHBlbmQodGhpcy4kZmlsdGVySGVhZGVyKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmVkcmF3cyB0aGUgZGF0YXRhYmxlXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7RmlsdGVyc30gVGhlIEZpbHRlcnMgb2JqZWN0XG4gICAgICovXG4gICAgZHJhd1RhYmxlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMudGFibGVBUEkuZHJhdygpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZXMgdGhlIGNvbHVtbiBkYXRhIChjdXJyZW50IGZpbHRlciBpcyBpZ25vcmVkKVxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbnR9IGNvbCBUaGUgY29sdW1uIGluZGV4ICgwIGJhc2VkKVxuICAgICAqXG4gICAgICogQHJldHVybiB7alF1ZXJ5fSBUaGUgdW5maWx0ZXJlZCBjb2x1bW4gcmVuZGVyZWQgZGF0YVxuICAgICAqL1xuICAgIGdldENvbHVtbkRhdGE6IGZ1bmN0aW9uIChjb2wpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudGFibGVBUEkuY29sdW1uKGNvbCkuZGF0YSgpLnVuaXF1ZSgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZXMgdGhlIGNvbHVtbiBmaWx0ZXJlZCBkYXRhXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ludH0gY29sIFRoZSBjb2x1bW4gaW5kZXggKDAgYmFzZWQpXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtqUXVlcnl9IFRoZSBmaWx0ZXJlZCBjb2x1bW4gZGF0YVxuICAgICAqL1xuICAgIGdldEZpbHRlcmVkQ29sdW1uRGF0YTogZnVuY3Rpb24gKGNvbCkge1xuICAgICAgICByZXR1cm4gdGhpcy50YWJsZUFQSS5jb2x1bW4oY29sLCB7c2VhcmNoOiAnYXBwbGllZCd9KS5kYXRhKCkudW5pcXVlKCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEFjdGlvbnMgdG8gZXhlY3V0ZSB3aGVuIHRoZSBkYXRhdGFibGUgaXMgZG9uZSBpbml0aWFsaXppbmcuXG4gICAgICogQ3JlYXRlcyB0aGUgZmlsdGVyIGhlYWRlciByb3csIHJlZ2lzdGVycyBhamF4IGxpc3RlbmVycyBhbmRcbiAgICAgKiByZW5kZXJzIGZpbHRlcnNcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJzfSBUaGUgRmlsdGVycyBvYmplY3RcbiAgICAgKi9cbiAgICBvbkRhdGFUYWJsZUluaXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5zZXR1cEhlYWRlclJvdygpLnJlZ2lzdGVyQWpheExpc3RlbmVyKCkucmVuZGVyRmlsdGVycygpO1xuXG4gICAgICAgIHRoaXMudGFibGVBUEkub24oICdjb2x1bW4tdmlzaWJpbGl0eS5kdCcsIGZ1bmN0aW9uICggZSwgc2V0dGluZ3MsIGNvbHVtbiwgdmlzaWJsZSApIHtcbiAgICAgICAgICAgIC8vIEZpbmQgdGhlIGZpbHRlciBhc3NvY2lhdGVkIHRvIHRoZSBjb2x1bW5cbiAgICAgICAgICAgIHZhciBmaWx0ZXIgPSB0aGlzLmZpbHRlcnMuZmluZChmdW5jdGlvbiAoZmlsdGVyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZpbHRlci5jb2x1bW4gPT09IGNvbHVtbjtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBGaW5kIHRoZSBjb2x1bW4gaW5kZXggaW50byB0aGUgRE9NXG4gICAgICAgICAgICB2YXIgcmVuZGVyQ29sdW1uID0gc2V0dGluZ3MuYW9Db2x1bW5zLnNsaWNlKDAsIGNvbHVtbilcbiAgICAgICAgICAgIC5yZWR1Y2UoZnVuY3Rpb24gKGFjYywgY29sdW1uKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNvbHVtbi5iVmlzaWJsZSA/IGFjYyArIDEgOiBhY2M7XG4gICAgICAgICAgICB9LCAwKTtcblxuICAgICAgICAgICAgaWYodmlzaWJsZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuY3JlYXRlRmlsdGVyV3JhcHBlcihyZW5kZXJDb2x1bW4pO1xuXG4gICAgICAgICAgICAgICAgaWYoZmlsdGVyKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEZJWDogaWYgYSBmaWx0ZXIgd2FzIGhpZGRlbiBhdCB0aGUgc3RhcnR1cCwgc28gaXQgZG9lc24ndCBoYXZlIHJlbmRlckNvbHVtbiBzZXR0ZWQsXG4gICAgICAgICAgICAgICAgICAgIC8vIFNvIHdlIG5lZWQgdG8gcmUtY29tcHV0ZSBpdFxuICAgICAgICAgICAgICAgICAgICBmaWx0ZXIucmVuZGVyQ29sdW1uID0gdGhpcy50YWJsZUFQSS5jb2x1bW4uaW5kZXgoJ3RvVmlzaWJsZScsIGZpbHRlci5jb2x1bW4pO1xuXG4gICAgICAgICAgICAgICAgICAgIGZpbHRlci5pbml0aWFsaXplKCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyRmlsdGVyKGZpbHRlcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZihmaWx0ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgZmlsdGVyLnJlbW92ZSgpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMucmVtb3ZlRmlsdGVyV3JhcHBlcihyZW5kZXJDb2x1bW4pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBXaGVuIGEgY2xpZW50LXNpZGUgZmlsdGVyIGNoYW5nZXMsIGFwcGxpZXMgaXRzIG5ldyB2YWx1ZVxuICAgICAqXG4gICAgICogQHBhcmFtIHtFdmVudH0gZXZlbnQgVGhlIGV2ZW50IG9iamVjdFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwYXJhbXMgVGhlIGV2ZW50IHBhcmFtc1xuICAgICAqXG4gICAgICogQHJldHVybiB7RmlsdGVyc30gVGhlIEZpbHRlcnMgb2JqZWN0XG4gICAgICovXG4gICAgb25DbGllbnRGaWx0ZXJDaGFuZ2U6IGZ1bmN0aW9uIChldmVudCwgcGFyYW1zKSB7XG4gICAgICAgIHRoaXMuYXBwbHlGaWx0ZXIocGFyYW1zLmZpbHRlcilcbiAgICAgICAgICAgIC5yZWZyZXNoQWxsRmlsdGVycyhwYXJhbXMuZmlsdGVyKVxuICAgICAgICAgICAgLmRyYXdUYWJsZSgpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBXaGVuIGEgc2VydmVyLXNpZGUgZmlsdGVyIGNoYW5nZXMsIGJ1aWxkcyB0aGUgbmV3IGFqYXggcXVlcnkgYW5kIHJlZnJlc2hlcyB0aGUgdGFibGVcbiAgICAgKlxuICAgICAqIEByZXR1cm4ge0ZpbHRlcnN9IFRoZSBGaWx0ZXJzIG9iamVjdFxuICAgICAqL1xuICAgIG9uU2VydmVyRmlsdGVyQ2hhbmdlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBzZXJ2ZXJRdWVyeSA9IHRoaXMuZmlsdGVycy5maWx0ZXIoZnVuY3Rpb24gKGZpbHRlcikge1xuICAgICAgICAgICAgcmV0dXJuIGZpbHRlci5pc1NlcnZlclNpZGUoKTtcbiAgICAgICAgfSkubWFwKGZ1bmN0aW9uIChmaWx0ZXIpIHtcbiAgICAgICAgICAgIHJldHVybiBmaWx0ZXIuZ2V0U2VydmVyUXVlcnkoKTtcbiAgICAgICAgfSkuam9pbignJicpO1xuXG4gICAgICAgIHRoaXMudGFibGVBUEkuYWpheC51cmwodGhpcy51cmwgKyAnPycgKyBzZXJ2ZXJRdWVyeSkuYWpheC5yZWxvYWQoKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQXBwbGllcyB0aGUgZmlsdGVyIHZhbHVlIHRvIHRoZSByZWxhdGVkIGNvbHVtblxuICAgICAqXG4gICAgICogQHBhcmFtIHtCYXNlRmlsdGVyfSBmaWx0ZXIgVGhlIGZpbHRlciBvYmplY3RcbiAgICAgKlxuICAgICAqIEByZXR1cm4ge0ZpbHRlcnN9IFRoZSBGaWx0ZXJzIG9iamVjdFxuICAgICAqL1xuICAgIGFwcGx5RmlsdGVyOiBmdW5jdGlvbiAoZmlsdGVyKSB7XG4gICAgICAgIHRoaXMudGFibGVBUEkuY29sdW1uKGZpbHRlci5jb2x1bW4pLnNlYXJjaChcbiAgICAgICAgICAgIGZpbHRlci5nZXRRdWVyeSgpLFxuICAgICAgICAgICAgZmlsdGVyLmlzUmVnZXhNYXRjaCgpXG4gICAgICAgICAgICAsIGZhbHNlKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHNlZSB0aGlzLnJlbmRlckZpbHRlclxuICAgICAqXG4gICAgICogQHJldHVybnMge0ZpbHRlcnN9IFRoZSBGaWx0ZXJzIG9iamVjdFxuICAgICAqL1xuICAgIHJlbmRlckZpbHRlcnM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5maWx0ZXJzLmZvckVhY2godGhpcy5yZW5kZXJGaWx0ZXIsIHRoaXMpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBc2tzIGEgZmlsdGVyIHRvIHJlbmRlciBpdHNlbGYgYW5kIHByb3ZpZGVzIGFuIG9wdGlvbmFsIGNvbnRhaW5lclxuICAgICAqIGZvciBmaWx0ZXJzIHRoYXQgbmVlZCB0byBiZSByZW5kZXJlZCBpbnNpZGUgdGhlIGRhdGF0YWJsZSBoZWFkZXIgcm93XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Jhc2VGaWx0ZXJ9IGZpbHRlciBUaGUgZmlsdGVyIG9iamVjdFxuICAgICAqL1xuICAgIHJlbmRlckZpbHRlcjogZnVuY3Rpb24gKGZpbHRlcikge1xuICAgICAgICB2YXIgY29sID0gZmlsdGVyLmNvbHVtbjtcbiAgICAgICAgdmFyICRjb2xIZWFkZXIgPSAkKHRoaXMudGFibGVBUEkuY29sdW1uKGNvbCkuaGVhZGVyKCkpO1xuICAgICAgICB2YXIgJGNvbnRhaW5lciA9IHRoaXMuJGhlYWRlci5maW5kKCcuZGF0YXRhYmxlLWZpbHRlcnMtaGVhZGVyIHRoOmVxKCcgKyBmaWx0ZXIucmVuZGVyQ29sdW1uICsgJyknKTtcblxuICAgICAgICBpZiAoZmlsdGVyLmlzU2VydmVyU2lkZSgpKSB7XG4gICAgICAgICAgICBmaWx0ZXIucmVnaXN0ZXIodGhpcy5vblNlcnZlckZpbHRlckNoYW5nZS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZpbHRlci5yZWdpc3Rlcih0aGlzLm9uQ2xpZW50RmlsdGVyQ2hhbmdlLmJpbmQodGhpcykpO1xuICAgICAgICB9XG5cbiAgICAgICAgZmlsdGVyLnJlbmRlcigkY29udGFpbmVyLCAkY29sSGVhZGVyLmh0bWwoKSwgdGhpcy5nZXRDb2x1bW5EYXRhKGNvbCkpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZWZyZXNoZXMgdGhlIGZpbHRlcnMgYmFzZWQgb24gdGhlIGN1cnJlbnRseSBkaXNwbGF5ZWQgZGF0YSBmb3IgZWFjaCBjb2x1bW5cbiAgICAgKlxuICAgICAqIEByZXR1cm4ge0ZpbHRlcnN9IFRoZSBGaWx0ZXJzIG9iamVjdFxuICAgICAqL1xuICAgIHJlZnJlc2hGaWx0ZXJzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuZmlsdGVycy5mb3JFYWNoKGZ1bmN0aW9uIChmaWx0ZXIpIHtcbiAgICAgICAgICAgIGZpbHRlci5yZWZyZXNoKHRoaXMuZ2V0Q29sdW1uRGF0YShmaWx0ZXIuY29sdW1uKSk7XG4gICAgICAgICAgICB0aGlzLmFwcGx5RmlsdGVyKGZpbHRlcik7XG4gICAgICAgIH0sIHRoaXMpO1xuXG4gICAgICAgIHRoaXMuZHJhd1RhYmxlKCk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIGZpbHRlcidzIGhlYWRlciBjZWxsXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGluZGV4IHRoZSBpbmRleCBvZiB0aGUgY2VsbCB0byBjcmVhdGVcbiAgICAgKiBAcmV0dXJuIHtGaWx0ZXJzfSBUaGUgRmlsdGVycyBvYmplY3RcbiAgICAgKi9cbiAgICBjcmVhdGVGaWx0ZXJXcmFwcGVyOiBmdW5jdGlvbiAoaW5kZXgpIHtcbiAgICAgICAgaWYoaW5kZXggPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMuJGZpbHRlckhlYWRlci5wcmVwZW5kKCc8dGgvPicpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy4kZmlsdGVySGVhZGVyLmZpbmQoJ3RoOmVxKCcgKyAoaW5kZXggLSAxKSArICcpJylcbiAgICAgICAgICAgIC5hZnRlcignPHRoLz4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmUgYSBmaWx0ZXIncyBoZWFkZXIgY2VsbFxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCB0aGUgaW5kZXggb2YgdGhlIGNlbGwgdG8gcmVtb3ZlXG4gICAgICogQHJldHVybiB7RmlsdGVyc30gVGhlIEZpbHRlcnMgb2JqZWN0XG4gICAgICovXG4gICAgcmVtb3ZlRmlsdGVyV3JhcHBlcjogZnVuY3Rpb24gKGluZGV4KSB7XG4gICAgICAgIHRoaXMuJGZpbHRlckhlYWRlci5maW5kKCd0aDplcSgnICsgaW5kZXggKyAnKScpLnJlbW92ZSgpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbn07XG5cbiQoZG9jdW1lbnQpLm9uKCdwcmVJbml0LmR0JywgZnVuY3Rpb24gKGUsIHNldHRpbmdzKSB7XG4gICAgbmV3IEZpbHRlcnMoc2V0dGluZ3MpO1xufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gRmlsdGVycztcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snJCddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnJCddIDogbnVsbCk7XG52YXIgQmFzZUZpbHRlciA9IHJlcXVpcmUoJy4uL2Jhc2VmaWx0ZXInKTtcbnZhciBTaW1wbGVSZW5kZXJlciA9IHJlcXVpcmUoJy4uL3JlbmRlcmVyL3NpbXBsZScpO1xudmFyIEZpbHRlcnMgPSByZXF1aXJlKCcuLi9maWx0ZXJzJyk7XG5cbnZhciBJbnB1dEZpbHRlciA9ICQuZXh0ZW5kKHt9LCBCYXNlRmlsdGVyLCBTaW1wbGVSZW5kZXJlciwge1xuXG4gICAgaW5pdDogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLiRkb20gPSAkKCc8aW5wdXQgY2xhc3M9XCJmaWx0cmVcIi8+Jyk7XG4gICAgICAgIHRoaXMuJGRvbS52YWwodGhpcy5nZXRJbml0aWFsUXVlcnkoKSk7XG4gICAgICAgIHRoaXMuJGRvbS5vbignaW5wdXQnLCB0aGlzLm5vdGlmeUNoYW5nZS5iaW5kKHRoaXMpKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgcG9wdWxhdGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIHVwZGF0ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgbm9TZWxlY3Rpb25RdWVyeTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gJyc7XG4gICAgfSxcblxuICAgIGlzUmVnZXhNYXRjaDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9LFxuXG4gICAgaGFzVmFsdWU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuJGRvbS52YWwoKSAhPSAnJztcbiAgICB9LFxuXG4gICAgc2VsZWN0ZWRRdWVyeTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy4kZG9tLnZhbCgpO1xuICAgIH0sXG5cbiAgICBnZXRJbml0aWFsUXVlcnk6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuICcnO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgICogUmVzZXQgdGhlIGZpbHRlcidzIGlucHV0LFxuICAgICAgKiBzbyB0aGUgZmlsdGVyIHdpbGwga2VlcCBldmVyeSByb3dzXG4gICAgICAqIEByZXR1cm5zIHtJbnB1dEZpbHRlcn0gVGhlIEZpbHRlciBvYmplY3RcbiAgICAgICovXG4gICAgcmVzZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy4kZG9tLnZhbCgnJyk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG59KTtcblxuRmlsdGVycy5wcm90b3R5cGUuYnVpbGRlcnMuaW5wdXQgPSBmdW5jdGlvbiAoc2V0dGluZ3MpIHtcbiAgICByZXR1cm4gJC5leHRlbmQoe30sIElucHV0RmlsdGVyLCBzZXR0aW5ncyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IElucHV0RmlsdGVyO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5yZXF1aXJlKCcuL3VwZGF0ZXIvdXBkYXRlTm9uZScpO1xucmVxdWlyZSgnLi91cGRhdGVyL3VwZGF0ZU90aGVycycpO1xucmVxdWlyZSgnLi9zZWxlY3Qvc2ltcGxlc2VsZWN0Jyk7XG5yZXF1aXJlKCcuL3NlbGVjdC9tdWx0aXNlbGVjdCcpO1xucmVxdWlyZSgnLi9zZWxlY3QvZml4ZWRzZWxlY3QnKTtcbnJlcXVpcmUoJy4vaW5wdXQvaW5wdXQnKTtcbnJlcXVpcmUoJy4vZmlsdGVycycpO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgU2ltcGxlUmVuZGVyZXIgPSB7XG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoJGNvbnRhaW5lciwgaGVhZGVyLCBkYXRhKSB7XG4gICAgICAgIHRoaXMucG9wdWxhdGUoZGF0YSk7XG4gICAgICAgIHRoaXMuc2hvd0ZpbHRlcih0aGlzLiRkb20sICRjb250YWluZXIsIGhlYWRlciwgZGF0YSk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIHNob3dGaWx0ZXI6IGZ1bmN0aW9uKCRkb20sICRjb250YWluZXIsIGhlYWRlcikge1xuICAgICAgICAkY29udGFpbmVyLmFwcGVuZCh0aGlzLiRkb20pO1xuICAgICAgICB0aGlzLiRkb20uYXR0cignbmFtZScsIGhlYWRlcikuYXR0cigncGxhY2Vob2xkZXInLCBoZWFkZXIpLnNob3coKTtcbiAgICB9LFxuXG4gICAgcmVmcmVzaDogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgdGhpcy51cGRhdGUoZGF0YSk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBTaW1wbGVSZW5kZXJlcjsiLCIndXNlIHN0cmljdCc7XG5cbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJyQnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJyQnXSA6IG51bGwpO1xudmFyIEJhc2VGaWx0ZXIgPSByZXF1aXJlKCcuLi9iYXNlZmlsdGVyJyk7XG52YXIgU2ltcGxlUmVuZGVyZXIgPSByZXF1aXJlKCcuLi9yZW5kZXJlci9zaW1wbGUnKTtcbnZhciBCb290c3RyYXBSZW5kZXJlciA9IHJlcXVpcmUoJy4vcmVuZGVyZXIvYm9vdHN0cmFwJyk7XG52YXIgQ2hvc2VuUmVuZGVyID0gcmVxdWlyZSgnLi9yZW5kZXJlci9jaG9zZW4nKTtcblxuLyoqXG4gKiBTZWxlY3RGaWx0ZXIgcmVncm91cHMgY29tbW9uIGJlaGF2aW9yIGZvciBzZWxlY3QgZmlsdGVyc1xuICovXG52YXIgU2VsZWN0RmlsdGVyID0gJC5leHRlbmQoe30sIEJhc2VGaWx0ZXIsIHtcbiAgICBzZWxlY3RlZDogW10sXG5cbiAgICAvKipcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIGFuIGFsd2F5cyBmYWxzZSByZWdleCB0byBoaWRlIGV2ZXJ5IHJlY29yZHNcbiAgICAgKiB3aGVuIG5vIG9wdGlvbiBpcyBzZWxlY3RlZFxuICAgICAqL1xuICAgIG5vU2VsZWN0aW9uUXVlcnk6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuICckLl4nO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZS4gU2VsZWN0IGZpbHRlcnMgYWx3YXlzIHVzZSByZWdleFxuICAgICAqL1xuICAgIGlzUmVnZXhNYXRjaDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgdHJ1ZSBpZiBhdCBsZWFzdCBvbmUgb3B0aW9uIGlzIHNlbGVjdGVkXG4gICAgICovXG4gICAgaGFzVmFsdWU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2dldFNlbGVjdGlvbigpLmxlbmd0aCA+IDA7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBjb2x1bW4gZmlsdGVyIHF1ZXJ5IHRvIGFwcGx5LiBTZWxlY3RlZCBvcHRpb24gdmFsdWVzXG4gICAgICogYXJlIGNvbmNhdGVuYXRlZCBpbnRvIGEgc3RyaW5nIHVzaW5nIHRoZSBwaXBlIGNoYXJhY3RlciAocmVnZXggb3IpXG4gICAgICovXG4gICAgc2VsZWN0ZWRRdWVyeTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZ2V0U2VsZWN0aW9uKCkubWFwKGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgaWYgKHZhbHVlID09IHRoaXMuYWxsVGV4dCB8fCB0aGlzLl9nZXROb3RTZWxlY3RlZCgpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICdeJyArICQuZm4uZGF0YVRhYmxlLnV0aWwuZXNjYXBlUmVnZXgodmFsdWUpICsgJyQnO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LCB0aGlzKS5qb2luKCd8Jyk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEZpbHRlcnMgdGhlIG9wdGlvbnMgYmVmb3JlIGFkZGluZyB0aGVtIHRvIHRoZSBzZWxlY3QuIENhbiBiZSBvdmVycmlkZGVuXG4gICAgICogZm9yIHNwZWNpZmljIGZpbHRlcmluZy5cbiAgICAgKiBCeSBkZWZhdWx0LCB1c2UgdGhlIHZhbHVlIGFzIG9wdGlvbiBpZiBgdmFsdWVgIGlmIGEgbm9uIGVtcHR5IHN0cmluZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSB2YWx1ZSBUaGUgb3B0aW9uIHZhbHVlXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gVHJ1ZSBpZiB0aGUgdmFsdWUgY2FuIGJlIGluY2x1ZGVkIGluIHRoZSBmaWx0ZXIgb3B0aW9ucy4gRmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIGZpbHRlck9wdGlvbnM6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICByZXR1cm4gdmFsdWUgJiYgdmFsdWUudHJpbSgpICE9ICcnO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgICogUmVzZXQgdGhlIGZpbHRlciBieSBzZWxlY3Qgbm9uZSBvcHRpb24sXG4gICAgICAqIHNvIHRoZSBmaWx0ZXIgd2lsbCBrZWVwIGV2ZXJ5IHJvd3NcbiAgICAgICogQHJldHVybnMge1NlbGVjdEZpbHRlcn0gVGhlIEZpbHRlciBvYmplY3RcbiAgICAgICovXG4gICAgcmVzZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy4kZG9tLmZpbmQoJ29wdGlvbicpLnJlbW92ZUF0dHIoJ3NlbGVjdGVkJyk7XG4gICAgICAgIHRoaXMuX3NhdmVTZWxlY3Rpb24oKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU29ydCB0aGUgb3B0aW9ucyBiZWZvcmUgYWRkaW5nIHRoZW0gdG8gdGhlIHNlbGVjdC4gQ2FuIGJlIG92ZXJyaWRkZW4gZm9yXG4gICAgICogc3BlY2lmaWMgc29ydHNcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBhIFRoZSBmaXJzdCB2YWx1ZSB0byBjb21wYXJlXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGIgVGhlIHNlY29uZCB2YWx1ZSB0byBjb21wYXJlXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtJbnRlZ2VyfSAwIGlmIHRoZSB0d28gdmFsdWVzIGFyZSBlcXVhbCwgMSBpZiBhID4gYiBhbmQgLTEgaWYgYSA8IGJcbiAgICAgKi9cbiAgICBzb3J0T3B0aW9uczogZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgaWYgKGEgPiBiKSB7XG4gICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhIDwgYikge1xuICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEByZXR1cm5zIHtBcnJheTxTdHJpbmc+fSBUaGUgYXJyYXkgb2Ygc2VsZWN0ZWQgdmFsdWVzXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZ2V0U2VsZWN0aW9uOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLiRkb20uZmluZCgnb3B0aW9uOnNlbGVjdGVkJykudG9BcnJheSgpLm1hcChmdW5jdGlvbiAob3B0aW9uKSB7XG4gICAgICAgICAgICByZXR1cm4gb3B0aW9uLnZhbHVlO1xuICAgICAgICB9KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7KnxBcnJheX0gVGhlIGFycmF5IG9mIG5vbiBzZWxlY3RlZCB2YWx1ZXNcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9nZXROb3RTZWxlY3RlZDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy4kZG9tLmZpbmQoJzpub3Qob3B0aW9uOnNlbGVjdGVkKScpLnRvQXJyYXkoKS5tYXAoZnVuY3Rpb24gKG9wdGlvbikge1xuICAgICAgICAgICAgcmV0dXJuIG9wdGlvbi52YWx1ZTtcbiAgICAgICAgfSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEZvciBlYWNoIGVsZW1lbnQgaW4gdGhlIGRhdGEgb2JqZWN0LCBjcmVhdGVzIGFuIG9wdGlvbiBlbGVtZW50IHVzaW5nIHRoZSBmdW5jdGlvblxuICAgICAqIGZuQ3JlYXRlXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2pRdWVyeX0gZGF0YSBUaGUgZGF0YSB0byBhZGQgdG8gdGhlIHNlbGVjdFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGZuQ3JlYXRlIFRoZSBmdW5jdGlvbiB0byB1c2UgdG8gY3JlYXRlIHRoZSBvcHRpb25zXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfYWRkT3B0aW9uczogZnVuY3Rpb24gKGRhdGEsIGZuQ3JlYXRlKSB7XG4gICAgICAgIHRoaXMuJGRvbS5lbXB0eSgpO1xuXG4gICAgICAgIGlmICh0aGlzLmFsbFRleHQpXG4gICAgICAgICAgICBmbkNyZWF0ZS5jYWxsKHRoaXMsIHRoaXMuYWxsVGV4dCk7XG5cbiAgICAgICAgZGF0YS50b0FycmF5KCkuZmlsdGVyKHRoaXMuZmlsdGVyT3B0aW9ucykuc29ydCh0aGlzLnNvcnRPcHRpb25zKS5mb3JFYWNoKGZuQ3JlYXRlLCB0aGlzKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIHNlbGVjdGVkIG9wdGlvblxuICAgICAqXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHZhbHVlIFRoZSBvcHRpb24gdmFsdWVcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9hZGRTZWxlY3RlZE9wdGlvbjogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuJGRvbS5hcHBlbmQoJCgnPG9wdGlvbi8+JylcbiAgICAgICAgICAgICAgICAudmFsKHZhbHVlKVxuICAgICAgICAgICAgICAgIC50ZXh0KHZhbHVlKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdzZWxlY3RlZCcsICdzZWxlY3RlZCcpXG4gICAgICAgICk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYW4gb3B0aW9uIHdpdGggdGhlIHNlbGVjdGVkIGZsYWcgYmFzZWQgb24gdGhlXG4gICAgICogY3VycmVudCBmaWx0ZXIgc3RhdGVcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSB2YWx1ZSBUaGUgb3B0aW9uIHZhbHVlXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcmVmcmVzaE9wdGlvbjogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIHZhciAkb3B0aW9uID0gJCgnPG9wdGlvbi8+JylcbiAgICAgICAgICAgIC52YWwodmFsdWUpXG4gICAgICAgICAgICAudGV4dCh2YWx1ZSk7XG5cbiAgICAgICAgaWYgKCQuaW5BcnJheSh2YWx1ZSwgdGhpcy5zZWxlY3RlZCkgPiAtMSlcbiAgICAgICAgICAgICRvcHRpb24uYXR0cignc2VsZWN0ZWQnLCAnc2VsZWN0ZWQnKTtcblxuICAgICAgICB0aGlzLiRkb20uYXBwZW5kKCRvcHRpb24pO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBUYWtlcyBhIHNuYXBzaG90IG9mIHRoZSBjdXJyZW50IHNlbGVjdGlvbiBzdGF0ZVxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc2F2ZVNlbGVjdGlvbjogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnNlbGVjdGVkID0gdGhpcy5fZ2V0U2VsZWN0aW9uKCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFdoZW5ldmVyIHRoZSBzZWxlY3Qgc3RhdGUgY2hhbmdlcywgc2F2ZSBpdHMgbmV3IHN0YXRlIGFuZFxuICAgICAqIG5vdGlmeSB0aGUgbGlzdGVuaW5nIGNvbXBvbmVudFxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25DaGFuZ2U6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5fc2F2ZVNlbGVjdGlvbigpO1xuICAgICAgICB0aGlzLm5vdGlmeUNoYW5nZSgpO1xuICAgIH1cbn0pO1xuXG52YXIgYXZhaWxhYmxlUmVuZGVyZXJzID0ge1xuICAgICdib290c3RyYXAnOiBCb290c3RyYXBSZW5kZXJlcixcbiAgICAnY2hvc2VuJzogQ2hvc2VuUmVuZGVyXG59O1xuXG52YXIgYnVpbGRlciA9IGZ1bmN0aW9uIChzZXR0aW5ncykge1xuICAgIHZhciByZW5kZXJlciA9IGF2YWlsYWJsZVJlbmRlcmVyc1tzZXR0aW5ncy5yZW5kZXJlcl0gfHwgU2ltcGxlUmVuZGVyZXI7XG5cbiAgICByZXR1cm4gJC5leHRlbmQoe30sIHRoaXMsIHJlbmRlcmVyLCBzZXR0aW5ncyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBTZWxlY3RGaWx0ZXI6IFNlbGVjdEZpbHRlcixcbiAgICBidWlsZGVyOiBidWlsZGVyXG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgJCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WyckJ10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWyckJ10gOiBudWxsKTtcbnZhciBGaWx0ZXJzID0gcmVxdWlyZSgnLi4vZmlsdGVycycpO1xudmFyIEJhc2VTZWxlY3QgPSByZXF1aXJlKCcuL2Jhc2VzZWxlY3QnKTtcblxudmFyIEZpeGVkU2VsZWN0RmlsdGVyID0gJC5leHRlbmQoe30sIEJhc2VTZWxlY3QuU2VsZWN0RmlsdGVyLCB7XG5cbiAgICAvKipcbiAgICAgKiBTaW1wbHkgc2F2ZXMgYSBoYW5kbGUgb24gdGhlIHByb3ZpZGVkIHNvdXJjZSBzZWxlY3RcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtGaXhlZFNlbGVjdEZpbHRlcn0gVGhlIHNlbGVjdCBmaWx0ZXJcbiAgICAgKi9cbiAgICBpbml0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuJGRvbSA9ICQodGhpcy5zcmMpO1xuICAgICAgICB0aGlzLiRkb20ub24oJ2NoYW5nZScsIHRoaXMubm90aWZ5Q2hhbmdlLmJpbmQodGhpcykpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBObyBhY3Rpb24gZm9yIGZpeGVkIGZpbHRlcnM6IHRoZSBwcm92aWRlZCBzZWxlY3QgaXMgdXNlZCBhcyBpc1xuICAgICAqXG4gICAgICogQHJldHVybnMge0ZpeGVkU2VsZWN0RmlsdGVyfSBUaGUgRmlsdGVyIG9iamVjdFxuICAgICAqL1xuICAgIHBvcHVsYXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBObyB1cGRhdGUgZm9yIGZpeGVkIGZpbHRlcnM6IHRoZSBwcm92aWRlZCBzZWxlY3QgaXMgbmV2ZXIgY2hhbmdlZFxuICAgICAqXG4gICAgICogQHJldHVybnMge0ZpeGVkU2VsZWN0RmlsdGVyfSBUaGUgRmlsdGVyIG9iamVjdFxuICAgICAqL1xuICAgIHVwZGF0ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogRml4ZWQgZmlsdGVycyBjYW4gYmUgdXNlZCB0byBwcm92aWRlIGluaXRpYWwgZmlsdGVycyB0byBhcHBseSB0byB0aGVcbiAgICAgKiBkYXRhdGFibGUuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgRmlsdGVyIHF1ZXJ5XG4gICAgICovXG4gICAgZ2V0SW5pdGlhbFF1ZXJ5OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0UXVlcnkoKTtcbiAgICB9XG59KTtcblxuRmlsdGVycy5wcm90b3R5cGUuYnVpbGRlcnMuZml4ZWRzZWxlY3QgPSBCYXNlU2VsZWN0LmJ1aWxkZXIuYmluZChGaXhlZFNlbGVjdEZpbHRlcik7XG5cbm1vZHVsZS5leHBvcnRzID0gRml4ZWRTZWxlY3RGaWx0ZXI7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJyQnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJyQnXSA6IG51bGwpO1xudmFyIEZpbHRlcnMgPSByZXF1aXJlKCcuLi9maWx0ZXJzJyk7XG52YXIgQmFzZVNlbGVjdCA9IHJlcXVpcmUoJy4vYmFzZXNlbGVjdCcpO1xuXG52YXIgTXVsdGlTZWxlY3RGaWx0ZXIgPSAkLmV4dGVuZCh7fSwgQmFzZVNlbGVjdC5TZWxlY3RGaWx0ZXIsIHtcblxuICAgIC8qKlxuICAgICAqIEluaXRpYWxpemVzIGEgbXVsdGlzZWxlY3QgZG9tIG9iamVjdFxuICAgICAqXG4gICAgICogQHJldHVybnMge011bHRpU2VsZWN0RmlsdGVyfSBUaGUgRmlsdGVyIG9iamVjdFxuICAgICAqL1xuICAgIGluaXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy4kZG9tID0gJCgnPHNlbGVjdCBjbGFzcz1cImZpbHRyZVwiLz4nKS5hdHRyKCdtdWx0aXBsZScsICdtdWx0aXBsZScpO1xuICAgICAgICB0aGlzLiRkb20ub24oJ2NoYW5nZScsIHRoaXMuX29uQ2hhbmdlLmJpbmQodGhpcykpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBQb3B1bGF0ZXMgdGhlIG11bHRpc2VsZWN0IHdpdGggJ3NlbGVjdGVkJyBvcHRpb25zIGJ5IGRlZmF1bHRcbiAgICAgKiBVc2VzIGdldEluaXRpYWxRdWVyeSBhcyBkZWZhdWx0IHZhbHVlKHMpXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FycmF5PFN0cmluZz59IGRhdGEgVGhlIGNvbHVtbiBkYXRhXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7TXVsdGlTZWxlY3RGaWx0ZXJ9IFRoZSBGaWx0ZXIgb2JqZWN0XG4gICAgICovXG4gICAgcG9wdWxhdGU6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgIHRoaXMuX2FkZE9wdGlvbnMoZGF0YSwgdGhpcy5fYWRkU2VsZWN0ZWRPcHRpb24pO1xuXG4gICAgICAgIC8vIFNlbGVjdCBlYWNoIHZhbHVlcyByZXR1cm5lZCBieSBnZXRJbml0aWFsUXVlcnlcbiAgICAgICAgdmFyIGluaXRpYWxRdWVyeSA9IHRoaXMuZ2V0SW5pdGlhbFF1ZXJ5KCk7XG4gICAgICAgIGlmKGluaXRpYWxRdWVyeSkge1xuICAgICAgICAgICAgdGhpcy5fdW5zZWxlY3RBbGxPcHRpb25zKCk7XG4gICAgICAgICAgICBpZihBcnJheS5pc0FycmF5KGluaXRpYWxRdWVyeSkpIHtcbiAgICAgICAgICAgICAgICBpbml0aWFsUXVlcnkuZm9yRWFjaCh0aGlzLl9zZWxlY3RPcHRpb24uYmluZCh0aGlzKSk7XG4gICAgICAgICAgICB9IGVsc2UgeyAvLyBBc3VtZSBpbml0aWFsIHF1ZXJ5IGlzIGEgbm9uIGVtcHR5IHN0cmluZ1xuICAgICAgICAgICAgICAgIHRoaXMuX3NlbGVjdE9wdGlvbihpbml0aWFsUXVlcnkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fc2F2ZVNlbGVjdGlvbigpO1xuICAgICAgICB0aGlzLl9vbkNoYW5nZSgpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBJZiB0aGUgJ2FsbCcgb3B0aW9uIGlzIHNlbGVjdGVkLCBzZXRzIHRoZSBuZXcgb3B0aW9ucyBhcyAnc2VsZWN0ZWQnLlxuICAgICAqIE90aGVyd2lzZSwgYWRkcyB0aGUgb3B0aW9ucyBiYXNlZCBvbiB0aGUgZmlsdGVyIHN0YXRlXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FycmF5PFN0cmluZz59IGRhdGEgVGhlIGNvbHVtbiBkYXRhXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7TXVsdGlTZWxlY3RGaWx0ZXJ9IFRoZSBGaWx0ZXIgb2JqZWN0XG4gICAgICovXG4gICAgdXBkYXRlOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICBpZiAoJC5pbkFycmF5KHRoaXMuYWxsVGV4dCwgdGhpcy5zZWxlY3RlZCkgPiAtMSB8fCB0aGlzLl9nZXROb3RTZWxlY3RlZCgpLmxlbmd0aCA9PSAwKVxuICAgICAgICAgICAgdGhpcy5fYWRkT3B0aW9ucyhkYXRhLCB0aGlzLl9hZGRTZWxlY3RlZE9wdGlvbik7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIHRoaXMuX2FkZE9wdGlvbnMoZGF0YSwgdGhpcy5fcmVmcmVzaE9wdGlvbik7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFRoaXMgZmlsdGVyIGlzIGR5bmFtaWMsIGl0IGNhbid0IGJlIHVzZWQgZm9yIGluaXRpYWwgZmlsdGVyaW5nXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgZmlsdGVyIGluaXRpYWwgcXVlcnlcbiAgICAgKi9cbiAgICBnZXRJbml0aWFsUXVlcnk6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuICcnO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiByZW1vdmUgYWxsIHNlbGVjdGVkIG9wdGlvbnNcbiAgICAgKi9cbiAgICBfdW5zZWxlY3RBbGxPcHRpb25zOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuJGRvbS5maW5kKCdvcHRpb246c2VsZWN0ZWQnKS5wcm9wKCdzZWxlY3RlZCcsIGZhbHNlKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogZmluZCBhbiBvcHRpb24gYnkgaXRzIHZhbHVlLCBhbmQgc2VsZWN0IGl0XG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHZhbHVlIG9wdGlvbidzIHZhbHVlXG4gICAgICovXG4gICAgX3NlbGVjdE9wdGlvbjogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuJGRvbS5maW5kKCdvcHRpb25bdmFsdWU9XCInICsgdmFsdWUgKyAnXCJdJykucHJvcCgnc2VsZWN0ZWQnLCB0cnVlKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmVzZXQgdGhlIGZpbHRlciBieSBzZWxlY3QgYWxsIG9wdGlvbnMsXG4gICAgICogc28gdGhlIGZpbHRlciB3aWxsIGtlZXAgZXZlcnkgcm93c1xuICAgICAqIEByZXR1cm5zIHtNdWx0aVNlbGVjdEZpbHRlcn0gVGhlIEZpbHRlciBvYmplY3RcbiAgICAgKi9cbiAgICByZXNldDogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgYWxsVmFsdWVzID0gdGhpcy4kZG9tLmZpbmQoJ29wdGlvbicpLmdldCgpLm1hcChmdW5jdGlvbiAob3B0aW9uKSB7XG4gICAgICAgICAgICByZXR1cm4gb3B0aW9uLnZhbHVlO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy4kZG9tLnZhbChhbGxWYWx1ZXMpO1xuICAgICAgICB0aGlzLl9zYXZlU2VsZWN0aW9uKCk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxufSk7XG5cbkZpbHRlcnMucHJvdG90eXBlLmJ1aWxkZXJzLm11bHRpc2VsZWN0ID0gQmFzZVNlbGVjdC5idWlsZGVyLmJpbmQoTXVsdGlTZWxlY3RGaWx0ZXIpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE11bHRpU2VsZWN0RmlsdGVyO1xuIiwiJ3VzZSBzdHJpY3QnO1xudmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snJCddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnJCddIDogbnVsbCk7XG5cbnZhciBCb290c3RyYXBSZW5kZXJlciA9IHtcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgkY29udGFpbmVyLCBoZWFkZXIsIGRhdGEpIHtcbiAgICAgICAgdGhpcy5wb3B1bGF0ZShkYXRhKTtcbiAgICAgICAgdGhpcy5zaG93RmlsdGVyKHRoaXMuJGRvbSwgJGNvbnRhaW5lciwgaGVhZGVyLCBkYXRhKTtcblxuICAgICAgICB2YXIgZGVmYXVsdE9wdGlvbnMgPSB7XG4gICAgICAgICAgICBidXR0b25UZXh0OiBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICAgICAgICAgIHZhciBuYlNlbGVjdGVkID0gJChvcHRpb25zKS5maWx0ZXIoJzpzZWxlY3RlZCcpLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBpZiAobmJTZWxlY3RlZCA9PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBoZWFkZXI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBoZWFkZXIgKyAnICgnICsgbmJTZWxlY3RlZCArICcpJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLiRkb20ubXVsdGlzZWxlY3QoJC5leHRlbmQoZGVmYXVsdE9wdGlvbnMsIHRoaXMucmVuZGVyZXJPcHRpb25zKSk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIHNob3dGaWx0ZXI6IGZ1bmN0aW9uICgkZG9tLCAkY29udGFpbmVyKSB7XG4gICAgICAgICRjb250YWluZXIuYXBwZW5kKHRoaXMuJGRvbSk7XG4gICAgfSxcblxuICAgIHJlZnJlc2g6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgIHRoaXMudXBkYXRlKGRhdGEpO1xuICAgICAgICB0aGlzLiRkb20ubXVsdGlzZWxlY3QoJ3JlYnVpbGQnKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEJvb3RzdHJhcFJlbmRlcmVyOyIsIid1c2Ugc3RyaWN0JztcblxudmFyIENob3NlblJlbmRlcmVyID0ge1xuICAgIHJlbmRlcjogZnVuY3Rpb24gKCRjb250YWluZXIsIGhlYWRlciwgZGF0YSkge1xuICAgICAgICB0aGlzLnBvcHVsYXRlKGRhdGEpO1xuICAgICAgICB0aGlzLnNob3dGaWx0ZXIodGhpcy4kZG9tLCAkY29udGFpbmVyLCBoZWFkZXIsIGRhdGEpO1xuICAgICAgICB0aGlzLiRkb20uY2hvc2VuKHRoaXMucmVuZGVyZXJPcHRpb25zIHx8IHt9KTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgc2hvd0ZpbHRlcjogZnVuY3Rpb24oJGRvbSwgJGNvbnRhaW5lcikge1xuICAgICAgICAkY29udGFpbmVyLmFwcGVuZCh0aGlzLiRkb20pO1xuICAgIH0sXG5cbiAgICByZWZyZXNoOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICB0aGlzLnVwZGF0ZShkYXRhKTtcbiAgICAgICAgdGhpcy4kZG9tLnRyaWdnZXIoJ2Nob3Nlbjp1cGRhdGVkJyk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDaG9zZW5SZW5kZXJlcjsiLCIndXNlIHN0cmljdCc7XG5cbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJyQnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJyQnXSA6IG51bGwpO1xudmFyIEZpbHRlcnMgPSByZXF1aXJlKCcuLi9maWx0ZXJzJyk7XG52YXIgQmFzZVNlbGVjdCA9IHJlcXVpcmUoJy4vYmFzZXNlbGVjdCcpO1xuXG52YXIgU2ltcGxlU2VsZWN0RmlsdGVyID0gJC5leHRlbmQoe30sIEJhc2VTZWxlY3QuU2VsZWN0RmlsdGVyLCB7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgc2ltcGxlIHNlbGVjdFxuICAgICAqXG4gICAgICogQHJldHVybnMge1NpbXBsZVNlbGVjdEZpbHRlcn0gVGhlIEZpbHRlciBvYmplY3RcbiAgICAgKi9cbiAgICBpbml0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuJGRvbSA9ICQoJzxzZWxlY3QgY2xhc3M9XCJmaWx0cmVcIi8+Jyk7XG4gICAgICAgIHRoaXMuJGRvbS5vbignY2hhbmdlJywgdGhpcy5fb25DaGFuZ2UuYmluZCh0aGlzKSk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEFkZHMgYWxsIG9wdGlvbnMgd2l0aG91dCBzcGVjaWZ5aW5nIHRoZSAnc2VsZWN0ZWQnIGZsYWdcbiAgICAgKiBJZiBhbiBvcHRpb24gd2l0aCBgZ2V0SW5pdGlhbFF1ZXJ5YCB2YWx1ZSBleGlzdHMsIHNlbGVjdHMgaXQsXG4gICAgICogb3RoZXJ3aXNlLCB0aGUgZmlyc3Qgb3B0aW9uIGlzIHNlbGVjdGVkIGJ5IGRlZmF1bHRcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXJyYXk8U3RyaW5nPn0gZGF0YSBUaGUgY29sdW1uIGRhdGFcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtTaW1wbGVTZWxlY3RGaWx0ZXJ9IFRoZSBmaWx0ZXIgb2JqZWN0XG4gICAgICovXG4gICAgcG9wdWxhdGU6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgIHRoaXMuX2FkZE9wdGlvbnMoZGF0YSwgdGhpcy5fcmVmcmVzaE9wdGlvbik7XG4gICAgICAgIHRoaXMuJGRvbS5maW5kKCdvcHRpb25bdmFsdWU9XCInICsgdGhpcy5nZXRJbml0aWFsUXVlcnkoKSArICdcIl0nKS5hdHRyKCdzZWxlY3RlZCcsICdzZWxlY3RlZCcpO1xuICAgICAgICB0aGlzLl9zYXZlU2VsZWN0aW9uKCk7XG4gICAgICAgIHRoaXMuX29uQ2hhbmdlKCk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJlZnJlc2ggdGhlIG9wdGlvbnMgYmFzZWQgb24gdGhlIGZpbHRlciBzdGF0ZVxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheTxTdHJpbmc+fSBkYXRhIFRoZSBjb2x1bW4gZGF0YVxuICAgICAqXG4gICAgICogQHJldHVybnMge1NpbXBsZVNlbGVjdEZpbHRlcn0gVGhlIGZpbHRlciBvYmplY3RcbiAgICAgKi9cbiAgICB1cGRhdGU6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgIHRoaXMuX2FkZE9wdGlvbnMoZGF0YSwgdGhpcy5fcmVmcmVzaE9wdGlvbik7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFRoaXMgZmlsdGVyIGlzIGR5bmFtaWMsIGl0IGNhbid0IGJlIHVzZWQgZm9yIGluaXRpYWwgZmlsdGVyaW5nXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgZmlsdGVyJ3MgaW5pdGlhbCBxdWVyeVxuICAgICAqL1xuICAgIGdldEluaXRpYWxRdWVyeTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAnJztcbiAgICB9XG59KTtcblxuRmlsdGVycy5wcm90b3R5cGUuYnVpbGRlcnMuc2VsZWN0ID0gQmFzZVNlbGVjdC5idWlsZGVyLmJpbmQoU2ltcGxlU2VsZWN0RmlsdGVyKTtcblxubW9kdWxlLmV4cG9ydHMgPSBTaW1wbGVTZWxlY3RGaWx0ZXI7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBGaWx0ZXJzID0gcmVxdWlyZSgnLi4vZmlsdGVycycpO1xuXG4vKipcbiAqIER1bW15IHVwZGF0ZXJcbiAqL1xudmFyIFVwZGF0ZU5vbmUgPSB7XG4gICAgcmVmcmVzaEFsbEZpbHRlcnM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxufTtcblxuRmlsdGVycy5wcm90b3R5cGUudXBkYXRlcnMubm9uZSA9IFVwZGF0ZU5vbmU7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBGaWx0ZXJzID0gcmVxdWlyZSgnLi4vZmlsdGVycycpO1xuXG4vKipcbiAqIEVhY2ggdGltZSBhIGZpbHRlciBjaGFuZ2VkLFxuICogcmVmcmVzaCB0aGUgb3RoZXJzIGZpbHRlcnMuXG4gKi9cbnZhciBVcGRhdGVPdGhlcnMgPSB7XG5cbiAgICByZWZyZXNoQWxsRmlsdGVyczogZnVuY3Rpb24gKGZpbHRlcikge1xuICAgICAgICAvLyByZWZyZXNoIGFsbCBmaWx0ZXJzXG4gICAgICAgIC8vIGV4Y2VwdCB0aGUgY2hhbmdlZCBvbmUsXG4gICAgICAgIC8vIHVubGVzcyB0aGUgZmlsdGVyIGlzIHJlc2V0dGVkLlxuICAgICAgICB2YXIgZmlsdGVyc1RvUmVmcmVzaCA9IHRoaXMuZmlsdGVyc1xuICAgICAgICAgICAgLmZpbHRlcihmdW5jdGlvbiAoZikge1xuICAgICAgICAgICAgICAgIHJldHVybiBmLmNvbHVtbiAhPT0gZmlsdGVyLmNvbHVtbjtcbiAgICAgICAgICAgIH0pO1xuXG5cbiAgICAgICAgZmlsdGVyc1RvUmVmcmVzaC5mb3JFYWNoKGZ1bmN0aW9uIChmaWx0ZXIpIHtcbiAgICAgICAgICAgIGZpbHRlci5yZWZyZXNoKHRoaXMuZ2V0RmlsdGVyZWRDb2x1bW5EYXRhKGZpbHRlci5jb2x1bW4pKTtcbiAgICAgICAgfSwgdGhpcyk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxufTtcblxuRmlsdGVycy5wcm90b3R5cGUudXBkYXRlcnMub3RoZXJzID0gVXBkYXRlT3RoZXJzO1xuIl19
