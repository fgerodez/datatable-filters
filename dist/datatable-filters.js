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
            this.$filterHeader.append('<th class="fond-header"></th>');
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJqcy9iYXNlZmlsdGVyLmpzIiwianMvZmlsdGVycy5qcyIsImpzL2lucHV0L2lucHV0LmpzIiwianMvbWFpbi5qcyIsImpzL3JlbmRlcmVyL3NpbXBsZS5qcyIsImpzL3NlbGVjdC9iYXNlc2VsZWN0LmpzIiwianMvc2VsZWN0L2ZpeGVkc2VsZWN0LmpzIiwianMvc2VsZWN0L211bHRpc2VsZWN0LmpzIiwianMvc2VsZWN0L3JlbmRlcmVyL2Jvb3RzdHJhcC5qcyIsImpzL3NlbGVjdC9yZW5kZXJlci9jaG9zZW4uanMiLCJqcy9zZWxlY3Qvc2ltcGxlc2VsZWN0LmpzIiwianMvdXBkYXRlci91cGRhdGVOb25lLmpzIiwianMvdXBkYXRlci91cGRhdGVPdGhlcnMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNoSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUN0VEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMvREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDdEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDMU1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDcERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQzVHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNuQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUN2QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcclxuXHJcbi8qKlxyXG4gKiBCYXNlRmlsdGVyXHJcbiAqL1xyXG52YXIgQmFzZUZpbHRlciA9IHtcclxuXHJcbiAgICBpbml0aWFsaXplOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy5pbml0KCk7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLmNsYXNzTmFtZSkge1xyXG4gICAgICAgICAgICB0aGlzLmFkZENsYXNzKHRoaXMuY2xhc3NOYW1lKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0aGlzLmF0dHJzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYWRkQXR0cmlidXRlcyh0aGlzLmF0dHJzKTtcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHJldHVybnMge0Jvb2xlYW59IFdoZXRoZXIgYSBmaWx0ZXIgY2hhbmdlIG11c3QgdHJpZ2dlciBhIGRhdGF0YWJsZSByZWxvYWQuXHJcbiAgICAgKiBEZWZhdWx0IGlzIGZhbHNlIChjbGllbnQgc2lkZSBmaWx0ZXIpLlxyXG4gICAgICovXHJcbiAgICBpc1NlcnZlclNpZGU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHJldHVybnMge1N0cmluZ30gVGhlIHJlcXVlc3QgcGFyYW1ldGVyIGFzc29jaWF0ZWQgd2l0aCB0aGlzIGZpbHRlciAoaW4gdGhlIGZvcm0ga2V5PXBhcmFtLFxyXG4gICAgICogb25seSB1c2VkIGZvciBzZXJ2ZXIgc2lkZSBmaWx0ZXJzKVxyXG4gICAgICovXHJcbiAgICBnZXRTZXJ2ZXJRdWVyeTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiAnJztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUcmlnZ2VycyBhbiB1cGRhdGUgZXZlbnRcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7QmFzZUZpbHRlcn0gVGhlIGZpbHRlciBvYmplY3RcclxuICAgICAqL1xyXG4gICAgbm90aWZ5Q2hhbmdlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy4kZG9tLnRyaWdnZXIoJ3VwZGF0ZS5maWx0ZXJzLmR0Jywge1xyXG4gICAgICAgICAgICBmaWx0ZXI6IHRoaXNcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHJldHVybnMge1N0cmluZ30gVGhlIGZpbHRlciBzdHJpbmcgdG8gYmUgYXBwbGllZCB0byB0aGUgZGF0YXRhYmxlIGNvbHVtblxyXG4gICAgICovXHJcbiAgICBnZXRRdWVyeTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIGlmICghdGhpcy5oYXNWYWx1ZSgpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm5vU2VsZWN0aW9uUXVlcnkoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzLnNlbGVjdGVkUXVlcnkoKTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZWdpc3RlcnMgYSBjYWxsYmFjayB0byBiZSBjYWxsZWQgd2hlbiB0aGUgdmFsdWUgb2YgdGhlIGZpbHRlciBjaGFuZ2VzXHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGFjdGlvbiB0byBwZXJmb3JtIHdoZW4gdGhlIGZpbHRlciB2YWx1ZSBjaGFuZ2VzXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge0Jhc2VGaWx0ZXJ9IFRoZSBmaWx0ZXIgb2JqZWN0XHJcbiAgICAgKi9cclxuICAgIHJlZ2lzdGVyOiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcclxuICAgICAgICB0aGlzLiRkb20ub24oJ3VwZGF0ZS5maWx0ZXJzLmR0JywgY2FsbGJhY2spO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBBZGRzIGEgY3NzIGNsYXNzIHRvIHRoZSBmaWx0ZXIgY29tcG9uZW50XHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGNzc0NsYXNzIFRoZSBjc3MgY2xhc3MgdG8gYWRkXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge0Jhc2VGaWx0ZXJ9IFRoZSBmaWx0ZXIgb2JqZWN0XHJcbiAgICAgKi9cclxuICAgIGFkZENsYXNzOiBmdW5jdGlvbiAoY3NzQ2xhc3MpIHtcclxuICAgICAgICB0aGlzLiRkb20uYWRkQ2xhc3MoY3NzQ2xhc3MpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBTZXRzIHRoZSBnaXZlbiB2YWx1ZXMgYXMgYXR0cmlidXRlcyBvZiB0aGUgZmlsdGVyIGNvbXBvbmVudFxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSB7QXJyYXl9IGF0dHJzIEFuIG9iamVjdCBvZiBhdHRyaWJ1dGUtdmFsdWUgcGFpcnMgdG8gc2V0XHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge0Jhc2VGaWx0ZXJ9IFRoZSBmaWx0ZXIgb2JqZWN0XHJcbiAgICAgKi9cclxuICAgIGFkZEF0dHJpYnV0ZXM6IGZ1bmN0aW9uIChhdHRycykge1xyXG4gICAgICAgIHRoaXMuJGRvbS5hdHRyKGF0dHJzKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVtb3ZlIHRoZSBmaWx0ZXIgZnJvbSB0aGUgRE9NLlxyXG4gICAgICogUmVzZXQgdGhlIGZpbHRlcidzIHZhbHVlIGJlZm9yZSByZW1vdmluZyB0byBkaXNhYmxlIGZpbHRlcmluZyBmb3IgdGhpcyBjb2x1bW4uXHJcbiAgICAgKi9cclxuICAgIHJlbW92ZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMucmVzZXQoKTtcclxuICAgICAgICB0aGlzLm5vdGlmeUNoYW5nZSgpO1xyXG5cclxuICAgICAgICB0aGlzLiRkb20ucmVtb3ZlKCk7XHJcbiAgICAgICAgZGVsZXRlIHRoaXMuJGRvbTtcclxuICAgIH1cclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQmFzZUZpbHRlcjtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snJCddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnJCddIDogbnVsbCk7XHJcblxyXG4vKipcclxuICogRmlsdGVycyBpcyBhIGNvbXBvbmVudCB0aGF0IG1hbmFnZXMgYSBsaXN0IG9mIGZpbHRlciBvYmplY3RzIGluc2lkZVxyXG4gKiBhIGRhdGF0YWJsZSBoZWFkZXIgcm93LlxyXG4gKlxyXG4gKiBUaGlzIGNvbnN0cnVjdG9yIGJpbmRzIGxpc3RlbmVycyB0byB2YXJpb3VzIGRhdGF0YWJsZSBldmVudHMuXHJcbiAqXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBzZXR0aW5ncyBvYmplY3QgdXNlZCB0byBjcmVhdGUgdGhlIGRhdGF0YWJsZVxyXG4gKi9cclxudmFyIEZpbHRlcnMgPSBmdW5jdGlvbiAoc2V0dGluZ3MpIHtcclxuICAgIHRoaXMuc2V0dGluZ3MgPSBzZXR0aW5ncztcclxuICAgIHRoaXMudGFibGVBUEkgPSBuZXcgJC5mbi5kYXRhVGFibGUuQXBpKHNldHRpbmdzKTtcclxuICAgIHRoaXMuJGhlYWRlciA9ICQodGhpcy50YWJsZUFQSS50YWJsZSgpLmhlYWRlcigpKTtcclxuICAgIHRoaXMudXJsID0gdGhpcy50YWJsZUFQSS5hamF4LnVybCgpO1xyXG5cclxuICAgIHRoaXMub3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCB0aGlzLmRlZmF1bHRTZXR0aW5ncywgdGhpcy50YWJsZUFQSS5pbml0KCkuZmlsdGVycyk7XHJcbiAgICAkLmV4dGVuZCh0aGlzLCB0aGlzLnVwZGF0ZXJzW3RoaXMub3B0aW9ucy51cGRhdGVyXSk7XHJcblxyXG4gICAgdGhpcy5maWx0ZXJzID0gc2V0dGluZ3MuYW9Db2x1bW5zLmZpbHRlcihmdW5jdGlvbiAocGFyYW0pIHtcclxuICAgICAgICByZXR1cm4gcGFyYW0uZmlsdGVyO1xyXG4gICAgfSkubWFwKGZ1bmN0aW9uIChwYXJhbSkge1xyXG4gICAgICAgIHZhciBvcHRpb25zID0gJC5leHRlbmQoe1xyXG4gICAgICAgICAgICBjb2x1bW46IHBhcmFtLmlkeCxcclxuICAgICAgICAgICAgcmVuZGVyQ29sdW1uOiB0aGlzLnRhYmxlQVBJLmNvbHVtbi5pbmRleCgndG9WaXNpYmxlJywgcGFyYW0uaWR4KVxyXG4gICAgICAgIH0sIHBhcmFtLmZpbHRlcik7XHJcblxyXG4gICAgICAgIHZhciBmaWx0ZXIgPSB0aGlzLmJ1aWxkZXJzW3BhcmFtLmZpbHRlci50eXBlXShvcHRpb25zKTtcclxuXHJcbiAgICAgICAgZmlsdGVyLmluaXRpYWxpemUoKTtcclxuXHJcbiAgICAgICAgdGhpcy5hcHBseUZpbHRlcihmaWx0ZXIpO1xyXG5cclxuICAgICAgICByZXR1cm4gZmlsdGVyO1xyXG4gICAgfSwgdGhpcyk7XHJcblxyXG4gICAgaWYgKHRoaXMuZmlsdGVycy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgdGhpcy50YWJsZUFQSS5vbignaW5pdCcsIHRoaXMub25EYXRhVGFibGVJbml0LmJpbmQodGhpcykpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuRmlsdGVycy5wcm90b3R5cGUgPSB7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBBcnJheSBvZiBmaWx0ZXIgY29uc3RydWN0b3IgZnVuY3Rpb24uIEVhY2ggZnVuY3Rpb25cclxuICAgICAqIHRha2VzIGEgc2V0dGluZyBvYmplY3QgYXMgaXRzIHNpbmdsZSBwYXJhbWV0ZXJcclxuICAgICAqL1xyXG4gICAgYnVpbGRlcnM6IHt9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQXJyYXkgb2YgdXBkYXRlciBjb25zdHJ1Y3RvciBmdW5jdGlvbi5cclxuICAgICAqIEVhY2ggZnVuY3Rpb24gdGFrZXMgdGhlIGZpbHRlciB0byB1cGRhdGUgYXMgaXRzIHNpbmdsZSBwYXJhbWV0ZXJcclxuICAgICAqL1xyXG4gICAgdXBkYXRlcnM6IHt9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQXJyYXkgb2YgZGVmYXVsdCBzZXR0aW5ncyBmb3IgdGhlIEZpbHRlciBvYmplY3RcclxuICAgICAqL1xyXG4gICAgZGVmYXVsdFNldHRpbmdzOiB7XHJcbiAgICAgICAgdXBkYXRlcjogJ25vbmUnXHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVmcmVzaGVzIGZpbHRlcnMgYWZ0ZXIgZWFjaCBhamF4IHJlcXVlc3RcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7RmlsdGVyc30gVGhlIEZpbHRlcnMgb2JqZWN0XHJcbiAgICAgKi9cclxuICAgIHJlZ2lzdGVyQWpheExpc3RlbmVyOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy50YWJsZUFQSS5vbigneGhyJywgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB0aGlzLnRhYmxlQVBJLm9uZSgncHJlRHJhdycsIHRoaXMucmVmcmVzaEZpbHRlcnMuYmluZCh0aGlzKSk7XHJcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogSW5pdGlhbGl6ZXMgdGhlIGhlYWRlciBIVE1MIGVsZW1lbnRzIHRoYXQgd2lsbCBiZSB1c2VkIHRvIGhvbGQgdGhlIGZpbHRlcnMuXHJcbiAgICAgKiBJdCBhbHNvIHJlZ2lzdGVycyB0aGUgbWFpbiBldmVudCBoYW5kbGVyIHRoYXQgd2lsbCByZWFjdCB0byB0aGUgZmlsdGVycydcclxuICAgICAqIHZhbHVlIGNoYW5nZXMuXHJcbiAgICAgKlxyXG4gICAgICogVGhlIGV2ZW50IG5hbWUgaXMgPGI+ZmlsdGVyQ2hhbmdlPC9iPi4gVGhpcyBldmVudCBtdXN0IGJlIHRyaWdnZXJlZCBieSB0aGVcclxuICAgICAqIGZpbHRlcnMgd2hlbiB0aGVpciB2YWx1ZSBpcyBtb2RpZmllZCBieSB0aGUgdXNlciAob3IgYW55IG90aGVyIGV2ZW50IHRoYXRcclxuICAgICAqIHNob3VsZCB0cmlnZ2VyIGEgZGF0YXRhYmxlIGZpbHRlcikuXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge0ZpbHRlcnN9IFRoZSBGaWx0ZXJzIG9iamVjdFxyXG4gICAgICovXHJcbiAgICBzZXR1cEhlYWRlclJvdzogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMuJGZpbHRlckhlYWRlciA9ICQoJzx0ciBjbGFzcz1cImRhdGF0YWJsZS1maWx0ZXJzLWhlYWRlciBmaWx0ZXJzXCI+PC90cj4nKTtcclxuXHJcbiAgICAgICAgdGhpcy5zZXR0aW5ncy5hb0NvbHVtbnMuZmlsdGVyKGZ1bmN0aW9uIChjb2x1bW4pIHtcclxuICAgICAgICAgICAgcmV0dXJuIGNvbHVtbi5iVmlzaWJsZTtcclxuICAgICAgICB9KVxyXG4gICAgICAgIC5mb3JFYWNoKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdGhpcy4kZmlsdGVySGVhZGVyLmFwcGVuZCgnPHRoIGNsYXNzPVwiZm9uZC1oZWFkZXJcIj48L3RoPicpO1xyXG4gICAgICAgIH0sIHRoaXMpO1xyXG5cclxuICAgICAgICB0aGlzLiRoZWFkZXIuYXBwZW5kKHRoaXMuJGZpbHRlckhlYWRlcik7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIFJlZHJhd3MgdGhlIGRhdGF0YWJsZVxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJzfSBUaGUgRmlsdGVycyBvYmplY3RcclxuICAgICAqL1xyXG4gICAgZHJhd1RhYmxlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy50YWJsZUFQSS5kcmF3KCk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIFJldHJpZXZlcyB0aGUgY29sdW1uIGRhdGEgKGN1cnJlbnQgZmlsdGVyIGlzIGlnbm9yZWQpXHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtIHtpbnR9IGNvbCBUaGUgY29sdW1uIGluZGV4ICgwIGJhc2VkKVxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm4ge2pRdWVyeX0gVGhlIHVuZmlsdGVyZWQgY29sdW1uIHJlbmRlcmVkIGRhdGFcclxuICAgICAqL1xyXG4gICAgZ2V0Q29sdW1uRGF0YTogZnVuY3Rpb24gKGNvbCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLnRhYmxlQVBJLmNvbHVtbihjb2wpLmRhdGEoKS51bmlxdWUoKTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXRyaWV2ZXMgdGhlIGNvbHVtbiBmaWx0ZXJlZCBkYXRhXHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtIHtpbnR9IGNvbCBUaGUgY29sdW1uIGluZGV4ICgwIGJhc2VkKVxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm4ge2pRdWVyeX0gVGhlIGZpbHRlcmVkIGNvbHVtbiBkYXRhXHJcbiAgICAgKi9cclxuICAgIGdldEZpbHRlcmVkQ29sdW1uRGF0YTogZnVuY3Rpb24gKGNvbCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLnRhYmxlQVBJLmNvbHVtbihjb2wsIHtzZWFyY2g6ICdhcHBsaWVkJ30pLmRhdGEoKS51bmlxdWUoKTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBBY3Rpb25zIHRvIGV4ZWN1dGUgd2hlbiB0aGUgZGF0YXRhYmxlIGlzIGRvbmUgaW5pdGlhbGl6aW5nLlxyXG4gICAgICogQ3JlYXRlcyB0aGUgZmlsdGVyIGhlYWRlciByb3csIHJlZ2lzdGVycyBhamF4IGxpc3RlbmVycyBhbmRcclxuICAgICAqIHJlbmRlcnMgZmlsdGVyc1xyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJzfSBUaGUgRmlsdGVycyBvYmplY3RcclxuICAgICAqL1xyXG4gICAgb25EYXRhVGFibGVJbml0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy5zZXR1cEhlYWRlclJvdygpLnJlZ2lzdGVyQWpheExpc3RlbmVyKCkucmVuZGVyRmlsdGVycygpO1xyXG5cclxuICAgICAgICB0aGlzLnRhYmxlQVBJLm9uKCAnY29sdW1uLXZpc2liaWxpdHkuZHQnLCBmdW5jdGlvbiAoIGUsIHNldHRpbmdzLCBjb2x1bW4sIHZpc2libGUgKSB7XHJcbiAgICAgICAgICAgIC8vIEZpbmQgdGhlIGZpbHRlciBhc3NvY2lhdGVkIHRvIHRoZSBjb2x1bW5cclxuICAgICAgICAgICAgdmFyIGZpbHRlciA9IHRoaXMuZmlsdGVycy5maW5kKGZ1bmN0aW9uIChmaWx0ZXIpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmaWx0ZXIuY29sdW1uID09PSBjb2x1bW47XHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgLy8gRmluZCB0aGUgY29sdW1uIGluZGV4IGludG8gdGhlIERPTVxyXG4gICAgICAgICAgICB2YXIgcmVuZGVyQ29sdW1uID0gc2V0dGluZ3MuYW9Db2x1bW5zLnNsaWNlKDAsIGNvbHVtbilcclxuICAgICAgICAgICAgLnJlZHVjZShmdW5jdGlvbiAoYWNjLCBjb2x1bW4pIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBjb2x1bW4uYlZpc2libGUgPyBhY2MgKyAxIDogYWNjO1xyXG4gICAgICAgICAgICB9LCAwKTtcclxuXHJcbiAgICAgICAgICAgIGlmKHZpc2libGUpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY3JlYXRlRmlsdGVyV3JhcHBlcihyZW5kZXJDb2x1bW4pO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmKGZpbHRlcikge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIEZJWDogaWYgYSBmaWx0ZXIgd2FzIGhpZGRlbiBhdCB0aGUgc3RhcnR1cCwgc28gaXQgZG9lc24ndCBoYXZlIHJlbmRlckNvbHVtbiBzZXR0ZWQsXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gU28gd2UgbmVlZCB0byByZS1jb21wdXRlIGl0XHJcbiAgICAgICAgICAgICAgICAgICAgZmlsdGVyLnJlbmRlckNvbHVtbiA9IHRoaXMudGFibGVBUEkuY29sdW1uLmluZGV4KCd0b1Zpc2libGUnLCBmaWx0ZXIuY29sdW1uKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgZmlsdGVyLmluaXRpYWxpemUoKTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlckZpbHRlcihmaWx0ZXIpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgaWYoZmlsdGVyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZmlsdGVyLnJlbW92ZSgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIHRoaXMucmVtb3ZlRmlsdGVyV3JhcHBlcihyZW5kZXJDb2x1bW4pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogV2hlbiBhIGNsaWVudC1zaWRlIGZpbHRlciBjaGFuZ2VzLCBhcHBsaWVzIGl0cyBuZXcgdmFsdWVcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0ge0V2ZW50fSBldmVudCBUaGUgZXZlbnQgb2JqZWN0XHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcGFyYW1zIFRoZSBldmVudCBwYXJhbXNcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJuIHtGaWx0ZXJzfSBUaGUgRmlsdGVycyBvYmplY3RcclxuICAgICAqL1xyXG4gICAgb25DbGllbnRGaWx0ZXJDaGFuZ2U6IGZ1bmN0aW9uIChldmVudCwgcGFyYW1zKSB7XHJcbiAgICAgICAgdGhpcy5hcHBseUZpbHRlcihwYXJhbXMuZmlsdGVyKVxyXG4gICAgICAgICAgICAucmVmcmVzaEFsbEZpbHRlcnMocGFyYW1zLmZpbHRlcilcclxuICAgICAgICAgICAgLmRyYXdUYWJsZSgpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBXaGVuIGEgc2VydmVyLXNpZGUgZmlsdGVyIGNoYW5nZXMsIGJ1aWxkcyB0aGUgbmV3IGFqYXggcXVlcnkgYW5kIHJlZnJlc2hlcyB0aGUgdGFibGVcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJuIHtGaWx0ZXJzfSBUaGUgRmlsdGVycyBvYmplY3RcclxuICAgICAqL1xyXG4gICAgb25TZXJ2ZXJGaWx0ZXJDaGFuZ2U6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgc2VydmVyUXVlcnkgPSB0aGlzLmZpbHRlcnMuZmlsdGVyKGZ1bmN0aW9uIChmaWx0ZXIpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGZpbHRlci5pc1NlcnZlclNpZGUoKTtcclxuICAgICAgICB9KS5tYXAoZnVuY3Rpb24gKGZpbHRlcikge1xyXG4gICAgICAgICAgICByZXR1cm4gZmlsdGVyLmdldFNlcnZlclF1ZXJ5KCk7XHJcbiAgICAgICAgfSkuam9pbignJicpO1xyXG5cclxuICAgICAgICB0aGlzLnRhYmxlQVBJLmFqYXgudXJsKHRoaXMudXJsICsgJz8nICsgc2VydmVyUXVlcnkpLmFqYXgucmVsb2FkKCk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEFwcGxpZXMgdGhlIGZpbHRlciB2YWx1ZSB0byB0aGUgcmVsYXRlZCBjb2x1bW5cclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0ge0Jhc2VGaWx0ZXJ9IGZpbHRlciBUaGUgZmlsdGVyIG9iamVjdFxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm4ge0ZpbHRlcnN9IFRoZSBGaWx0ZXJzIG9iamVjdFxyXG4gICAgICovXHJcbiAgICBhcHBseUZpbHRlcjogZnVuY3Rpb24gKGZpbHRlcikge1xyXG4gICAgICAgIHRoaXMudGFibGVBUEkuY29sdW1uKGZpbHRlci5jb2x1bW4pLnNlYXJjaChcclxuICAgICAgICAgICAgZmlsdGVyLmdldFF1ZXJ5KCksXHJcbiAgICAgICAgICAgIGZpbHRlci5pc1JlZ2V4TWF0Y2goKVxyXG4gICAgICAgICAgICAsIGZhbHNlKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHNlZSB0aGlzLnJlbmRlckZpbHRlclxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJzfSBUaGUgRmlsdGVycyBvYmplY3RcclxuICAgICAqL1xyXG4gICAgcmVuZGVyRmlsdGVyczogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMuZmlsdGVycy5mb3JFYWNoKHRoaXMucmVuZGVyRmlsdGVyLCB0aGlzKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQXNrcyBhIGZpbHRlciB0byByZW5kZXIgaXRzZWxmIGFuZCBwcm92aWRlcyBhbiBvcHRpb25hbCBjb250YWluZXJcclxuICAgICAqIGZvciBmaWx0ZXJzIHRoYXQgbmVlZCB0byBiZSByZW5kZXJlZCBpbnNpZGUgdGhlIGRhdGF0YWJsZSBoZWFkZXIgcm93XHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtIHtCYXNlRmlsdGVyfSBmaWx0ZXIgVGhlIGZpbHRlciBvYmplY3RcclxuICAgICAqL1xyXG4gICAgcmVuZGVyRmlsdGVyOiBmdW5jdGlvbiAoZmlsdGVyKSB7XHJcbiAgICAgICAgdmFyIGNvbCA9IGZpbHRlci5jb2x1bW47XHJcbiAgICAgICAgdmFyICRjb2xIZWFkZXIgPSAkKHRoaXMudGFibGVBUEkuY29sdW1uKGNvbCkuaGVhZGVyKCkpO1xyXG4gICAgICAgIHZhciAkY29udGFpbmVyID0gdGhpcy4kaGVhZGVyLmZpbmQoJy5kYXRhdGFibGUtZmlsdGVycy1oZWFkZXIgdGg6ZXEoJyArIGZpbHRlci5yZW5kZXJDb2x1bW4gKyAnKScpO1xyXG5cclxuICAgICAgICBpZiAoZmlsdGVyLmlzU2VydmVyU2lkZSgpKSB7XHJcbiAgICAgICAgICAgIGZpbHRlci5yZWdpc3Rlcih0aGlzLm9uU2VydmVyRmlsdGVyQ2hhbmdlLmJpbmQodGhpcykpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGZpbHRlci5yZWdpc3Rlcih0aGlzLm9uQ2xpZW50RmlsdGVyQ2hhbmdlLmJpbmQodGhpcykpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZmlsdGVyLnJlbmRlcigkY29udGFpbmVyLCAkY29sSGVhZGVyLmh0bWwoKSwgdGhpcy5nZXRDb2x1bW5EYXRhKGNvbCkpO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIFJlZnJlc2hlcyB0aGUgZmlsdGVycyBiYXNlZCBvbiB0aGUgY3VycmVudGx5IGRpc3BsYXllZCBkYXRhIGZvciBlYWNoIGNvbHVtblxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm4ge0ZpbHRlcnN9IFRoZSBGaWx0ZXJzIG9iamVjdFxyXG4gICAgICovXHJcbiAgICByZWZyZXNoRmlsdGVyczogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMuZmlsdGVycy5mb3JFYWNoKGZ1bmN0aW9uIChmaWx0ZXIpIHtcclxuICAgICAgICAgICAgZmlsdGVyLnJlZnJlc2godGhpcy5nZXRDb2x1bW5EYXRhKGZpbHRlci5jb2x1bW4pKTtcclxuICAgICAgICAgICAgdGhpcy5hcHBseUZpbHRlcihmaWx0ZXIpO1xyXG4gICAgICAgIH0sIHRoaXMpO1xyXG5cclxuICAgICAgICB0aGlzLmRyYXdUYWJsZSgpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGUgYSBmaWx0ZXIncyBoZWFkZXIgY2VsbFxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGluZGV4IHRoZSBpbmRleCBvZiB0aGUgY2VsbCB0byBjcmVhdGVcclxuICAgICAqIEByZXR1cm4ge0ZpbHRlcnN9IFRoZSBGaWx0ZXJzIG9iamVjdFxyXG4gICAgICovXHJcbiAgICBjcmVhdGVGaWx0ZXJXcmFwcGVyOiBmdW5jdGlvbiAoaW5kZXgpIHtcclxuICAgICAgICBpZihpbmRleCA9PT0gMCkge1xyXG4gICAgICAgICAgICB0aGlzLiRmaWx0ZXJIZWFkZXIucHJlcGVuZCgnPHRoLz4nKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLiRmaWx0ZXJIZWFkZXIuZmluZCgndGg6ZXEoJyArIChpbmRleCAtIDEpICsgJyknKVxyXG4gICAgICAgICAgICAuYWZ0ZXIoJzx0aC8+Jyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZW1vdmUgYSBmaWx0ZXIncyBoZWFkZXIgY2VsbFxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGluZGV4IHRoZSBpbmRleCBvZiB0aGUgY2VsbCB0byByZW1vdmVcclxuICAgICAqIEByZXR1cm4ge0ZpbHRlcnN9IFRoZSBGaWx0ZXJzIG9iamVjdFxyXG4gICAgICovXHJcbiAgICByZW1vdmVGaWx0ZXJXcmFwcGVyOiBmdW5jdGlvbiAoaW5kZXgpIHtcclxuICAgICAgICB0aGlzLiRmaWx0ZXJIZWFkZXIuZmluZCgndGg6ZXEoJyArIGluZGV4ICsgJyknKS5yZW1vdmUoKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcbn07XHJcblxyXG4kKGRvY3VtZW50KS5vbigncHJlSW5pdC5kdCcsIGZ1bmN0aW9uIChlLCBzZXR0aW5ncykge1xyXG4gICAgbmV3IEZpbHRlcnMoc2V0dGluZ3MpO1xyXG59KTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gRmlsdGVycztcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snJCddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnJCddIDogbnVsbCk7XHJcbnZhciBCYXNlRmlsdGVyID0gcmVxdWlyZSgnLi4vYmFzZWZpbHRlcicpO1xyXG52YXIgU2ltcGxlUmVuZGVyZXIgPSByZXF1aXJlKCcuLi9yZW5kZXJlci9zaW1wbGUnKTtcclxudmFyIEZpbHRlcnMgPSByZXF1aXJlKCcuLi9maWx0ZXJzJyk7XHJcblxyXG52YXIgSW5wdXRGaWx0ZXIgPSAkLmV4dGVuZCh7fSwgQmFzZUZpbHRlciwgU2ltcGxlUmVuZGVyZXIsIHtcclxuXHJcbiAgICBpbml0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy4kZG9tID0gJCgnPGlucHV0IGNsYXNzPVwiZmlsdHJlXCIvPicpO1xyXG4gICAgICAgIHRoaXMuJGRvbS52YWwodGhpcy5nZXRJbml0aWFsUXVlcnkoKSk7XHJcbiAgICAgICAgdGhpcy4kZG9tLm9uKCdpbnB1dCcsIHRoaXMubm90aWZ5Q2hhbmdlLmJpbmQodGhpcykpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgcG9wdWxhdGU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgdXBkYXRlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIG5vU2VsZWN0aW9uUXVlcnk6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gJyc7XHJcbiAgICB9LFxyXG5cclxuICAgIGlzUmVnZXhNYXRjaDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfSxcclxuXHJcbiAgICBoYXNWYWx1ZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLiRkb20udmFsKCkgIT0gJyc7XHJcbiAgICB9LFxyXG5cclxuICAgIHNlbGVjdGVkUXVlcnk6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy4kZG9tLnZhbCgpO1xyXG4gICAgfSxcclxuXHJcbiAgICBnZXRJbml0aWFsUXVlcnk6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gJyc7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICAqIFJlc2V0IHRoZSBmaWx0ZXIncyBpbnB1dCxcclxuICAgICAgKiBzbyB0aGUgZmlsdGVyIHdpbGwga2VlcCBldmVyeSByb3dzXHJcbiAgICAgICogQHJldHVybnMge0lucHV0RmlsdGVyfSBUaGUgRmlsdGVyIG9iamVjdFxyXG4gICAgICAqL1xyXG4gICAgcmVzZXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLiRkb20udmFsKCcnKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG59KTtcclxuXHJcbkZpbHRlcnMucHJvdG90eXBlLmJ1aWxkZXJzLmlucHV0ID0gZnVuY3Rpb24gKHNldHRpbmdzKSB7XHJcbiAgICByZXR1cm4gJC5leHRlbmQoe30sIElucHV0RmlsdGVyLCBzZXR0aW5ncyk7XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IElucHV0RmlsdGVyO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG5yZXF1aXJlKCcuL3VwZGF0ZXIvdXBkYXRlTm9uZScpO1xyXG5yZXF1aXJlKCcuL3VwZGF0ZXIvdXBkYXRlT3RoZXJzJyk7XHJcbnJlcXVpcmUoJy4vc2VsZWN0L3NpbXBsZXNlbGVjdCcpO1xyXG5yZXF1aXJlKCcuL3NlbGVjdC9tdWx0aXNlbGVjdCcpO1xyXG5yZXF1aXJlKCcuL3NlbGVjdC9maXhlZHNlbGVjdCcpO1xyXG5yZXF1aXJlKCcuL2lucHV0L2lucHV0Jyk7XHJcbnJlcXVpcmUoJy4vZmlsdGVycycpO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgU2ltcGxlUmVuZGVyZXIgPSB7XHJcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgkY29udGFpbmVyLCBoZWFkZXIsIGRhdGEpIHtcclxuICAgICAgICB0aGlzLnBvcHVsYXRlKGRhdGEpO1xyXG4gICAgICAgIHRoaXMuc2hvd0ZpbHRlcih0aGlzLiRkb20sICRjb250YWluZXIsIGhlYWRlciwgZGF0YSk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICBzaG93RmlsdGVyOiBmdW5jdGlvbigkZG9tLCAkY29udGFpbmVyLCBoZWFkZXIpIHtcclxuICAgICAgICAkY29udGFpbmVyLmFwcGVuZCh0aGlzLiRkb20pO1xyXG4gICAgICAgIHRoaXMuJGRvbS5hdHRyKCduYW1lJywgaGVhZGVyKS5hdHRyKCdwbGFjZWhvbGRlcicsIGhlYWRlcikuc2hvdygpO1xyXG4gICAgfSxcclxuXHJcbiAgICByZWZyZXNoOiBmdW5jdGlvbiAoZGF0YSkge1xyXG4gICAgICAgIHRoaXMudXBkYXRlKGRhdGEpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gU2ltcGxlUmVuZGVyZXI7IiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snJCddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnJCddIDogbnVsbCk7XHJcbnZhciBCYXNlRmlsdGVyID0gcmVxdWlyZSgnLi4vYmFzZWZpbHRlcicpO1xyXG52YXIgU2ltcGxlUmVuZGVyZXIgPSByZXF1aXJlKCcuLi9yZW5kZXJlci9zaW1wbGUnKTtcclxudmFyIEJvb3RzdHJhcFJlbmRlcmVyID0gcmVxdWlyZSgnLi9yZW5kZXJlci9ib290c3RyYXAnKTtcclxudmFyIENob3NlblJlbmRlciA9IHJlcXVpcmUoJy4vcmVuZGVyZXIvY2hvc2VuJyk7XHJcblxyXG4vKipcclxuICogU2VsZWN0RmlsdGVyIHJlZ3JvdXBzIGNvbW1vbiBiZWhhdmlvciBmb3Igc2VsZWN0IGZpbHRlcnNcclxuICovXHJcbnZhciBTZWxlY3RGaWx0ZXIgPSAkLmV4dGVuZCh7fSwgQmFzZUZpbHRlciwge1xyXG4gICAgc2VsZWN0ZWQ6IFtdLFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyBhbiBhbHdheXMgZmFsc2UgcmVnZXggdG8gaGlkZSBldmVyeSByZWNvcmRzXHJcbiAgICAgKiB3aGVuIG5vIG9wdGlvbiBpcyBzZWxlY3RlZFxyXG4gICAgICovXHJcbiAgICBub1NlbGVjdGlvblF1ZXJ5OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuICckLl4nO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlLiBTZWxlY3QgZmlsdGVycyBhbHdheXMgdXNlIHJlZ2V4XHJcbiAgICAgKi9cclxuICAgIGlzUmVnZXhNYXRjaDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIHRydWUgaWYgYXQgbGVhc3Qgb25lIG9wdGlvbiBpcyBzZWxlY3RlZFxyXG4gICAgICovXHJcbiAgICBoYXNWYWx1ZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9nZXRTZWxlY3Rpb24oKS5sZW5ndGggPiAwO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBjb2x1bW4gZmlsdGVyIHF1ZXJ5IHRvIGFwcGx5LiBTZWxlY3RlZCBvcHRpb24gdmFsdWVzXHJcbiAgICAgKiBhcmUgY29uY2F0ZW5hdGVkIGludG8gYSBzdHJpbmcgdXNpbmcgdGhlIHBpcGUgY2hhcmFjdGVyIChyZWdleCBvcilcclxuICAgICAqL1xyXG4gICAgc2VsZWN0ZWRRdWVyeTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9nZXRTZWxlY3Rpb24oKS5tYXAoZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICAgICAgICAgIGlmICh2YWx1ZSA9PSB0aGlzLmFsbFRleHQgfHwgdGhpcy5fZ2V0Tm90U2VsZWN0ZWQoKS5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiAnJztcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiAnXicgKyAkLmZuLmRhdGFUYWJsZS51dGlsLmVzY2FwZVJlZ2V4KHZhbHVlKSArICckJztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sIHRoaXMpLmpvaW4oJ3wnKTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBGaWx0ZXJzIHRoZSBvcHRpb25zIGJlZm9yZSBhZGRpbmcgdGhlbSB0byB0aGUgc2VsZWN0LiBDYW4gYmUgb3ZlcnJpZGRlblxyXG4gICAgICogZm9yIHNwZWNpZmljIGZpbHRlcmluZy5cclxuICAgICAqIEJ5IGRlZmF1bHQsIHVzZSB0aGUgdmFsdWUgYXMgb3B0aW9uIGlmIGB2YWx1ZWAgaWYgYSBub24gZW1wdHkgc3RyaW5nLlxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSB2YWx1ZSBUaGUgb3B0aW9uIHZhbHVlXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge0Jvb2xlYW59IFRydWUgaWYgdGhlIHZhbHVlIGNhbiBiZSBpbmNsdWRlZCBpbiB0aGUgZmlsdGVyIG9wdGlvbnMuIEZhbHNlIG90aGVyd2lzZS5cclxuICAgICAqL1xyXG4gICAgZmlsdGVyT3B0aW9uczogZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICAgICAgcmV0dXJuIHZhbHVlICYmIHZhbHVlLnRyaW0oKSAhPSAnJztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgICogUmVzZXQgdGhlIGZpbHRlciBieSBzZWxlY3Qgbm9uZSBvcHRpb24sXHJcbiAgICAgICogc28gdGhlIGZpbHRlciB3aWxsIGtlZXAgZXZlcnkgcm93c1xyXG4gICAgICAqIEByZXR1cm5zIHtTZWxlY3RGaWx0ZXJ9IFRoZSBGaWx0ZXIgb2JqZWN0XHJcbiAgICAgICovXHJcbiAgICByZXNldDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMuJGRvbS5maW5kKCdvcHRpb24nKS5yZW1vdmVBdHRyKCdzZWxlY3RlZCcpO1xyXG4gICAgICAgIHRoaXMuX3NhdmVTZWxlY3Rpb24oKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogU29ydCB0aGUgb3B0aW9ucyBiZWZvcmUgYWRkaW5nIHRoZW0gdG8gdGhlIHNlbGVjdC4gQ2FuIGJlIG92ZXJyaWRkZW4gZm9yXHJcbiAgICAgKiBzcGVjaWZpYyBzb3J0c1xyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBhIFRoZSBmaXJzdCB2YWx1ZSB0byBjb21wYXJlXHJcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gYiBUaGUgc2Vjb25kIHZhbHVlIHRvIGNvbXBhcmVcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJuIHtJbnRlZ2VyfSAwIGlmIHRoZSB0d28gdmFsdWVzIGFyZSBlcXVhbCwgMSBpZiBhID4gYiBhbmQgLTEgaWYgYSA8IGJcclxuICAgICAqL1xyXG4gICAgc29ydE9wdGlvbnM6IGZ1bmN0aW9uIChhLCBiKSB7XHJcbiAgICAgICAgaWYgKGEgPiBiKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAxO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGEgPCBiKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAtMTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiAwO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEByZXR1cm5zIHtBcnJheTxTdHJpbmc+fSBUaGUgYXJyYXkgb2Ygc2VsZWN0ZWQgdmFsdWVzXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICovXHJcbiAgICBfZ2V0U2VsZWN0aW9uOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuJGRvbS5maW5kKCdvcHRpb246c2VsZWN0ZWQnKS50b0FycmF5KCkubWFwKGZ1bmN0aW9uIChvcHRpb24pIHtcclxuICAgICAgICAgICAgcmV0dXJuIG9wdGlvbi52YWx1ZTtcclxuICAgICAgICB9KTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMgeyp8QXJyYXl9IFRoZSBhcnJheSBvZiBub24gc2VsZWN0ZWQgdmFsdWVzXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICovXHJcbiAgICBfZ2V0Tm90U2VsZWN0ZWQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy4kZG9tLmZpbmQoJzpub3Qob3B0aW9uOnNlbGVjdGVkKScpLnRvQXJyYXkoKS5tYXAoZnVuY3Rpb24gKG9wdGlvbikge1xyXG4gICAgICAgICAgICByZXR1cm4gb3B0aW9uLnZhbHVlO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEZvciBlYWNoIGVsZW1lbnQgaW4gdGhlIGRhdGEgb2JqZWN0LCBjcmVhdGVzIGFuIG9wdGlvbiBlbGVtZW50IHVzaW5nIHRoZSBmdW5jdGlvblxyXG4gICAgICogZm5DcmVhdGVcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0ge2pRdWVyeX0gZGF0YSBUaGUgZGF0YSB0byBhZGQgdG8gdGhlIHNlbGVjdFxyXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gZm5DcmVhdGUgVGhlIGZ1bmN0aW9uIHRvIHVzZSB0byBjcmVhdGUgdGhlIG9wdGlvbnNcclxuICAgICAqIEBwcml2YXRlXHJcbiAgICAgKi9cclxuICAgIF9hZGRPcHRpb25zOiBmdW5jdGlvbiAoZGF0YSwgZm5DcmVhdGUpIHtcclxuICAgICAgICB0aGlzLiRkb20uZW1wdHkoKTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuYWxsVGV4dClcclxuICAgICAgICAgICAgZm5DcmVhdGUuY2FsbCh0aGlzLCB0aGlzLmFsbFRleHQpO1xyXG5cclxuICAgICAgICBkYXRhLnRvQXJyYXkoKS5maWx0ZXIodGhpcy5maWx0ZXJPcHRpb25zKS5zb3J0KHRoaXMuc29ydE9wdGlvbnMpLmZvckVhY2goZm5DcmVhdGUsIHRoaXMpO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYSBzZWxlY3RlZCBvcHRpb25cclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gdmFsdWUgVGhlIG9wdGlvbiB2YWx1ZVxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqL1xyXG4gICAgX2FkZFNlbGVjdGVkT3B0aW9uOiBmdW5jdGlvbiAodmFsdWUpIHtcclxuICAgICAgICB0aGlzLiRkb20uYXBwZW5kKCQoJzxvcHRpb24vPicpXHJcbiAgICAgICAgICAgICAgICAudmFsKHZhbHVlKVxyXG4gICAgICAgICAgICAgICAgLnRleHQodmFsdWUpXHJcbiAgICAgICAgICAgICAgICAuYXR0cignc2VsZWN0ZWQnLCAnc2VsZWN0ZWQnKVxyXG4gICAgICAgICk7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhbiBvcHRpb24gd2l0aCB0aGUgc2VsZWN0ZWQgZmxhZyBiYXNlZCBvbiB0aGVcclxuICAgICAqIGN1cnJlbnQgZmlsdGVyIHN0YXRlXHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHZhbHVlIFRoZSBvcHRpb24gdmFsdWVcclxuICAgICAqIEBwcml2YXRlXHJcbiAgICAgKi9cclxuICAgIF9yZWZyZXNoT3B0aW9uOiBmdW5jdGlvbiAodmFsdWUpIHtcclxuICAgICAgICB2YXIgJG9wdGlvbiA9ICQoJzxvcHRpb24vPicpXHJcbiAgICAgICAgICAgIC52YWwodmFsdWUpXHJcbiAgICAgICAgICAgIC50ZXh0KHZhbHVlKTtcclxuXHJcbiAgICAgICAgaWYgKCQuaW5BcnJheSh2YWx1ZSwgdGhpcy5zZWxlY3RlZCkgPiAtMSlcclxuICAgICAgICAgICAgJG9wdGlvbi5hdHRyKCdzZWxlY3RlZCcsICdzZWxlY3RlZCcpO1xyXG5cclxuICAgICAgICB0aGlzLiRkb20uYXBwZW5kKCRvcHRpb24pO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIFRha2VzIGEgc25hcHNob3Qgb2YgdGhlIGN1cnJlbnQgc2VsZWN0aW9uIHN0YXRlXHJcbiAgICAgKlxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqL1xyXG4gICAgX3NhdmVTZWxlY3Rpb246IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLnNlbGVjdGVkID0gdGhpcy5fZ2V0U2VsZWN0aW9uKCk7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogV2hlbmV2ZXIgdGhlIHNlbGVjdCBzdGF0ZSBjaGFuZ2VzLCBzYXZlIGl0cyBuZXcgc3RhdGUgYW5kXHJcbiAgICAgKiBub3RpZnkgdGhlIGxpc3RlbmluZyBjb21wb25lbnRcclxuICAgICAqXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICovXHJcbiAgICBfb25DaGFuZ2U6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLl9zYXZlU2VsZWN0aW9uKCk7XHJcbiAgICAgICAgdGhpcy5ub3RpZnlDaGFuZ2UoKTtcclxuICAgIH1cclxufSk7XHJcblxyXG52YXIgYXZhaWxhYmxlUmVuZGVyZXJzID0ge1xyXG4gICAgJ2Jvb3RzdHJhcCc6IEJvb3RzdHJhcFJlbmRlcmVyLFxyXG4gICAgJ2Nob3Nlbic6IENob3NlblJlbmRlclxyXG59O1xyXG5cclxudmFyIGJ1aWxkZXIgPSBmdW5jdGlvbiAoc2V0dGluZ3MpIHtcclxuICAgIHZhciByZW5kZXJlciA9IGF2YWlsYWJsZVJlbmRlcmVyc1tzZXR0aW5ncy5yZW5kZXJlcl0gfHwgU2ltcGxlUmVuZGVyZXI7XHJcblxyXG4gICAgcmV0dXJuICQuZXh0ZW5kKHt9LCB0aGlzLCByZW5kZXJlciwgc2V0dGluZ3MpO1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBTZWxlY3RGaWx0ZXI6IFNlbGVjdEZpbHRlcixcclxuICAgIGJ1aWxkZXI6IGJ1aWxkZXJcclxufTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snJCddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnJCddIDogbnVsbCk7XHJcbnZhciBGaWx0ZXJzID0gcmVxdWlyZSgnLi4vZmlsdGVycycpO1xyXG52YXIgQmFzZVNlbGVjdCA9IHJlcXVpcmUoJy4vYmFzZXNlbGVjdCcpO1xyXG5cclxudmFyIEZpeGVkU2VsZWN0RmlsdGVyID0gJC5leHRlbmQoe30sIEJhc2VTZWxlY3QuU2VsZWN0RmlsdGVyLCB7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBTaW1wbHkgc2F2ZXMgYSBoYW5kbGUgb24gdGhlIHByb3ZpZGVkIHNvdXJjZSBzZWxlY3RcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7Rml4ZWRTZWxlY3RGaWx0ZXJ9IFRoZSBzZWxlY3QgZmlsdGVyXHJcbiAgICAgKi9cclxuICAgIGluaXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLiRkb20gPSAkKHRoaXMuc3JjKTtcclxuICAgICAgICB0aGlzLiRkb20ub24oJ2NoYW5nZScsIHRoaXMubm90aWZ5Q2hhbmdlLmJpbmQodGhpcykpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBObyBhY3Rpb24gZm9yIGZpeGVkIGZpbHRlcnM6IHRoZSBwcm92aWRlZCBzZWxlY3QgaXMgdXNlZCBhcyBpc1xyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtGaXhlZFNlbGVjdEZpbHRlcn0gVGhlIEZpbHRlciBvYmplY3RcclxuICAgICAqL1xyXG4gICAgcG9wdWxhdGU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBObyB1cGRhdGUgZm9yIGZpeGVkIGZpbHRlcnM6IHRoZSBwcm92aWRlZCBzZWxlY3QgaXMgbmV2ZXIgY2hhbmdlZFxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtGaXhlZFNlbGVjdEZpbHRlcn0gVGhlIEZpbHRlciBvYmplY3RcclxuICAgICAqL1xyXG4gICAgdXBkYXRlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRml4ZWQgZmlsdGVycyBjYW4gYmUgdXNlZCB0byBwcm92aWRlIGluaXRpYWwgZmlsdGVycyB0byBhcHBseSB0byB0aGVcclxuICAgICAqIGRhdGF0YWJsZS5cclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgRmlsdGVyIHF1ZXJ5XHJcbiAgICAgKi9cclxuICAgIGdldEluaXRpYWxRdWVyeTogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0UXVlcnkoKTtcclxuICAgIH1cclxufSk7XHJcblxyXG5GaWx0ZXJzLnByb3RvdHlwZS5idWlsZGVycy5maXhlZHNlbGVjdCA9IEJhc2VTZWxlY3QuYnVpbGRlci5iaW5kKEZpeGVkU2VsZWN0RmlsdGVyKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gRml4ZWRTZWxlY3RGaWx0ZXI7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJyQnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJyQnXSA6IG51bGwpO1xyXG52YXIgRmlsdGVycyA9IHJlcXVpcmUoJy4uL2ZpbHRlcnMnKTtcclxudmFyIEJhc2VTZWxlY3QgPSByZXF1aXJlKCcuL2Jhc2VzZWxlY3QnKTtcclxuXHJcbnZhciBNdWx0aVNlbGVjdEZpbHRlciA9ICQuZXh0ZW5kKHt9LCBCYXNlU2VsZWN0LlNlbGVjdEZpbHRlciwge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogSW5pdGlhbGl6ZXMgYSBtdWx0aXNlbGVjdCBkb20gb2JqZWN0XHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge011bHRpU2VsZWN0RmlsdGVyfSBUaGUgRmlsdGVyIG9iamVjdFxyXG4gICAgICovXHJcbiAgICBpbml0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy4kZG9tID0gJCgnPHNlbGVjdCBjbGFzcz1cImZpbHRyZVwiLz4nKS5hdHRyKCdtdWx0aXBsZScsICdtdWx0aXBsZScpO1xyXG4gICAgICAgIHRoaXMuJGRvbS5vbignY2hhbmdlJywgdGhpcy5fb25DaGFuZ2UuYmluZCh0aGlzKSk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIFBvcHVsYXRlcyB0aGUgbXVsdGlzZWxlY3Qgd2l0aCAnc2VsZWN0ZWQnIG9wdGlvbnMgYnkgZGVmYXVsdFxyXG4gICAgICogVXNlcyBnZXRJbml0aWFsUXVlcnkgYXMgZGVmYXVsdCB2YWx1ZShzKVxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSB7QXJyYXk8U3RyaW5nPn0gZGF0YSBUaGUgY29sdW1uIGRhdGFcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7TXVsdGlTZWxlY3RGaWx0ZXJ9IFRoZSBGaWx0ZXIgb2JqZWN0XHJcbiAgICAgKi9cclxuICAgIHBvcHVsYXRlOiBmdW5jdGlvbiAoZGF0YSkge1xyXG4gICAgICAgIHRoaXMuX2FkZE9wdGlvbnMoZGF0YSwgdGhpcy5fYWRkU2VsZWN0ZWRPcHRpb24pO1xyXG5cclxuICAgICAgICAvLyBTZWxlY3QgZWFjaCB2YWx1ZXMgcmV0dXJuZWQgYnkgZ2V0SW5pdGlhbFF1ZXJ5XHJcbiAgICAgICAgdmFyIGluaXRpYWxRdWVyeSA9IHRoaXMuZ2V0SW5pdGlhbFF1ZXJ5KCk7XHJcbiAgICAgICAgaWYoaW5pdGlhbFF1ZXJ5KSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3Vuc2VsZWN0QWxsT3B0aW9ucygpO1xyXG4gICAgICAgICAgICBpZihBcnJheS5pc0FycmF5KGluaXRpYWxRdWVyeSkpIHtcclxuICAgICAgICAgICAgICAgIGluaXRpYWxRdWVyeS5mb3JFYWNoKHRoaXMuX3NlbGVjdE9wdGlvbi5iaW5kKHRoaXMpKTtcclxuICAgICAgICAgICAgfSBlbHNlIHsgLy8gQXN1bWUgaW5pdGlhbCBxdWVyeSBpcyBhIG5vbiBlbXB0eSBzdHJpbmdcclxuICAgICAgICAgICAgICAgIHRoaXMuX3NlbGVjdE9wdGlvbihpbml0aWFsUXVlcnkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLl9zYXZlU2VsZWN0aW9uKCk7XHJcbiAgICAgICAgdGhpcy5fb25DaGFuZ2UoKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogSWYgdGhlICdhbGwnIG9wdGlvbiBpcyBzZWxlY3RlZCwgc2V0cyB0aGUgbmV3IG9wdGlvbnMgYXMgJ3NlbGVjdGVkJy5cclxuICAgICAqIE90aGVyd2lzZSwgYWRkcyB0aGUgb3B0aW9ucyBiYXNlZCBvbiB0aGUgZmlsdGVyIHN0YXRlXHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtIHtBcnJheTxTdHJpbmc+fSBkYXRhIFRoZSBjb2x1bW4gZGF0YVxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtNdWx0aVNlbGVjdEZpbHRlcn0gVGhlIEZpbHRlciBvYmplY3RcclxuICAgICAqL1xyXG4gICAgdXBkYXRlOiBmdW5jdGlvbiAoZGF0YSkge1xyXG4gICAgICAgIGlmICgkLmluQXJyYXkodGhpcy5hbGxUZXh0LCB0aGlzLnNlbGVjdGVkKSA+IC0xIHx8IHRoaXMuX2dldE5vdFNlbGVjdGVkKCkubGVuZ3RoID09IDApXHJcbiAgICAgICAgICAgIHRoaXMuX2FkZE9wdGlvbnMoZGF0YSwgdGhpcy5fYWRkU2VsZWN0ZWRPcHRpb24pO1xyXG4gICAgICAgIGVsc2VcclxuICAgICAgICAgICAgdGhpcy5fYWRkT3B0aW9ucyhkYXRhLCB0aGlzLl9yZWZyZXNoT3B0aW9uKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogVGhpcyBmaWx0ZXIgaXMgZHluYW1pYywgaXQgY2FuJ3QgYmUgdXNlZCBmb3IgaW5pdGlhbCBmaWx0ZXJpbmdcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgZmlsdGVyIGluaXRpYWwgcXVlcnlcclxuICAgICAqL1xyXG4gICAgZ2V0SW5pdGlhbFF1ZXJ5OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuICcnO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIHJlbW92ZSBhbGwgc2VsZWN0ZWQgb3B0aW9uc1xyXG4gICAgICovXHJcbiAgICBfdW5zZWxlY3RBbGxPcHRpb25zOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy4kZG9tLmZpbmQoJ29wdGlvbjpzZWxlY3RlZCcpLnByb3AoJ3NlbGVjdGVkJywgZmFsc2UpO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIGZpbmQgYW4gb3B0aW9uIGJ5IGl0cyB2YWx1ZSwgYW5kIHNlbGVjdCBpdFxyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHZhbHVlIG9wdGlvbidzIHZhbHVlXHJcbiAgICAgKi9cclxuICAgIF9zZWxlY3RPcHRpb246IGZ1bmN0aW9uICh2YWx1ZSkge1xyXG4gICAgICAgIHRoaXMuJGRvbS5maW5kKCdvcHRpb25bdmFsdWU9XCInICsgdmFsdWUgKyAnXCJdJykucHJvcCgnc2VsZWN0ZWQnLCB0cnVlKTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXNldCB0aGUgZmlsdGVyIGJ5IHNlbGVjdCBhbGwgb3B0aW9ucyxcclxuICAgICAqIHNvIHRoZSBmaWx0ZXIgd2lsbCBrZWVwIGV2ZXJ5IHJvd3NcclxuICAgICAqIEByZXR1cm5zIHtNdWx0aVNlbGVjdEZpbHRlcn0gVGhlIEZpbHRlciBvYmplY3RcclxuICAgICAqL1xyXG4gICAgcmVzZXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgYWxsVmFsdWVzID0gdGhpcy4kZG9tLmZpbmQoJ29wdGlvbicpLmdldCgpLm1hcChmdW5jdGlvbiAob3B0aW9uKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBvcHRpb24udmFsdWU7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgdGhpcy4kZG9tLnZhbChhbGxWYWx1ZXMpO1xyXG4gICAgICAgIHRoaXMuX3NhdmVTZWxlY3Rpb24oKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxuRmlsdGVycy5wcm90b3R5cGUuYnVpbGRlcnMubXVsdGlzZWxlY3QgPSBCYXNlU2VsZWN0LmJ1aWxkZXIuYmluZChNdWx0aVNlbGVjdEZpbHRlcik7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IE11bHRpU2VsZWN0RmlsdGVyO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJyQnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJyQnXSA6IG51bGwpO1xyXG5cclxudmFyIEJvb3RzdHJhcFJlbmRlcmVyID0ge1xyXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoJGNvbnRhaW5lciwgaGVhZGVyLCBkYXRhKSB7XHJcbiAgICAgICAgdGhpcy5wb3B1bGF0ZShkYXRhKTtcclxuICAgICAgICB0aGlzLnNob3dGaWx0ZXIodGhpcy4kZG9tLCAkY29udGFpbmVyLCBoZWFkZXIsIGRhdGEpO1xyXG5cclxuICAgICAgICB2YXIgZGVmYXVsdE9wdGlvbnMgPSB7XHJcbiAgICAgICAgICAgIGJ1dHRvblRleHQ6IGZ1bmN0aW9uIChvcHRpb25zKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgbmJTZWxlY3RlZCA9ICQob3B0aW9ucykuZmlsdGVyKCc6c2VsZWN0ZWQnKS5sZW5ndGg7XHJcbiAgICAgICAgICAgICAgICBpZiAobmJTZWxlY3RlZCA9PSAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGhlYWRlcjtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBoZWFkZXIgKyAnICgnICsgbmJTZWxlY3RlZCArICcpJztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRoaXMuJGRvbS5tdWx0aXNlbGVjdCgkLmV4dGVuZChkZWZhdWx0T3B0aW9ucywgdGhpcy5yZW5kZXJlck9wdGlvbnMpKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIHNob3dGaWx0ZXI6IGZ1bmN0aW9uICgkZG9tLCAkY29udGFpbmVyKSB7XHJcbiAgICAgICAgJGNvbnRhaW5lci5hcHBlbmQodGhpcy4kZG9tKTtcclxuICAgIH0sXHJcblxyXG4gICAgcmVmcmVzaDogZnVuY3Rpb24gKGRhdGEpIHtcclxuICAgICAgICB0aGlzLnVwZGF0ZShkYXRhKTtcclxuICAgICAgICB0aGlzLiRkb20ubXVsdGlzZWxlY3QoJ3JlYnVpbGQnKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEJvb3RzdHJhcFJlbmRlcmVyOyIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBDaG9zZW5SZW5kZXJlciA9IHtcclxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCRjb250YWluZXIsIGhlYWRlciwgZGF0YSkge1xyXG4gICAgICAgIHRoaXMucG9wdWxhdGUoZGF0YSk7XHJcbiAgICAgICAgdGhpcy5zaG93RmlsdGVyKHRoaXMuJGRvbSwgJGNvbnRhaW5lciwgaGVhZGVyLCBkYXRhKTtcclxuICAgICAgICB0aGlzLiRkb20uY2hvc2VuKHRoaXMucmVuZGVyZXJPcHRpb25zIHx8IHt9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIHNob3dGaWx0ZXI6IGZ1bmN0aW9uKCRkb20sICRjb250YWluZXIpIHtcclxuICAgICAgICAkY29udGFpbmVyLmFwcGVuZCh0aGlzLiRkb20pO1xyXG4gICAgfSxcclxuXHJcbiAgICByZWZyZXNoOiBmdW5jdGlvbiAoZGF0YSkge1xyXG4gICAgICAgIHRoaXMudXBkYXRlKGRhdGEpO1xyXG4gICAgICAgIHRoaXMuJGRvbS50cmlnZ2VyKCdjaG9zZW46dXBkYXRlZCcpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQ2hvc2VuUmVuZGVyZXI7IiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snJCddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnJCddIDogbnVsbCk7XHJcbnZhciBGaWx0ZXJzID0gcmVxdWlyZSgnLi4vZmlsdGVycycpO1xyXG52YXIgQmFzZVNlbGVjdCA9IHJlcXVpcmUoJy4vYmFzZXNlbGVjdCcpO1xyXG5cclxudmFyIFNpbXBsZVNlbGVjdEZpbHRlciA9ICQuZXh0ZW5kKHt9LCBCYXNlU2VsZWN0LlNlbGVjdEZpbHRlciwge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhIHNpbXBsZSBzZWxlY3RcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7U2ltcGxlU2VsZWN0RmlsdGVyfSBUaGUgRmlsdGVyIG9iamVjdFxyXG4gICAgICovXHJcbiAgICBpbml0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy4kZG9tID0gJCgnPHNlbGVjdCBjbGFzcz1cImZpbHRyZVwiLz4nKTtcclxuICAgICAgICB0aGlzLiRkb20ub24oJ2NoYW5nZScsIHRoaXMuX29uQ2hhbmdlLmJpbmQodGhpcykpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBBZGRzIGFsbCBvcHRpb25zIHdpdGhvdXQgc3BlY2lmeWluZyB0aGUgJ3NlbGVjdGVkJyBmbGFnXHJcbiAgICAgKiBJZiBhbiBvcHRpb24gd2l0aCBgZ2V0SW5pdGlhbFF1ZXJ5YCB2YWx1ZSBleGlzdHMsIHNlbGVjdHMgaXQsXHJcbiAgICAgKiBvdGhlcndpc2UsIHRoZSBmaXJzdCBvcHRpb24gaXMgc2VsZWN0ZWQgYnkgZGVmYXVsdFxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSB7QXJyYXk8U3RyaW5nPn0gZGF0YSBUaGUgY29sdW1uIGRhdGFcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7U2ltcGxlU2VsZWN0RmlsdGVyfSBUaGUgZmlsdGVyIG9iamVjdFxyXG4gICAgICovXHJcbiAgICBwb3B1bGF0ZTogZnVuY3Rpb24gKGRhdGEpIHtcclxuICAgICAgICB0aGlzLl9hZGRPcHRpb25zKGRhdGEsIHRoaXMuX3JlZnJlc2hPcHRpb24pO1xyXG4gICAgICAgIHRoaXMuJGRvbS5maW5kKCdvcHRpb25bdmFsdWU9XCInICsgdGhpcy5nZXRJbml0aWFsUXVlcnkoKSArICdcIl0nKS5hdHRyKCdzZWxlY3RlZCcsICdzZWxlY3RlZCcpO1xyXG4gICAgICAgIHRoaXMuX3NhdmVTZWxlY3Rpb24oKTtcclxuICAgICAgICB0aGlzLl9vbkNoYW5nZSgpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZWZyZXNoIHRoZSBvcHRpb25zIGJhc2VkIG9uIHRoZSBmaWx0ZXIgc3RhdGVcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0ge0FycmF5PFN0cmluZz59IGRhdGEgVGhlIGNvbHVtbiBkYXRhXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge1NpbXBsZVNlbGVjdEZpbHRlcn0gVGhlIGZpbHRlciBvYmplY3RcclxuICAgICAqL1xyXG4gICAgdXBkYXRlOiBmdW5jdGlvbiAoZGF0YSkge1xyXG4gICAgICAgIHRoaXMuX2FkZE9wdGlvbnMoZGF0YSwgdGhpcy5fcmVmcmVzaE9wdGlvbik7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIFRoaXMgZmlsdGVyIGlzIGR5bmFtaWMsIGl0IGNhbid0IGJlIHVzZWQgZm9yIGluaXRpYWwgZmlsdGVyaW5nXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge1N0cmluZ30gVGhlIGZpbHRlcidzIGluaXRpYWwgcXVlcnlcclxuICAgICAqL1xyXG4gICAgZ2V0SW5pdGlhbFF1ZXJ5OiBmdW5jdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gJyc7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxuRmlsdGVycy5wcm90b3R5cGUuYnVpbGRlcnMuc2VsZWN0ID0gQmFzZVNlbGVjdC5idWlsZGVyLmJpbmQoU2ltcGxlU2VsZWN0RmlsdGVyKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gU2ltcGxlU2VsZWN0RmlsdGVyO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgRmlsdGVycyA9IHJlcXVpcmUoJy4uL2ZpbHRlcnMnKTtcclxuXHJcbi8qKlxyXG4gKiBEdW1teSB1cGRhdGVyXHJcbiAqL1xyXG52YXIgVXBkYXRlTm9uZSA9IHtcclxuICAgIHJlZnJlc2hBbGxGaWx0ZXJzOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcbn07XHJcblxyXG5GaWx0ZXJzLnByb3RvdHlwZS51cGRhdGVycy5ub25lID0gVXBkYXRlTm9uZTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIEZpbHRlcnMgPSByZXF1aXJlKCcuLi9maWx0ZXJzJyk7XHJcblxyXG4vKipcclxuICogRWFjaCB0aW1lIGEgZmlsdGVyIGNoYW5nZWQsXHJcbiAqIHJlZnJlc2ggdGhlIG90aGVycyBmaWx0ZXJzLlxyXG4gKi9cclxudmFyIFVwZGF0ZU90aGVycyA9IHtcclxuXHJcbiAgICByZWZyZXNoQWxsRmlsdGVyczogZnVuY3Rpb24gKGZpbHRlcikge1xyXG4gICAgICAgIC8vIHJlZnJlc2ggYWxsIGZpbHRlcnNcclxuICAgICAgICAvLyBleGNlcHQgdGhlIGNoYW5nZWQgb25lLFxyXG4gICAgICAgIC8vIHVubGVzcyB0aGUgZmlsdGVyIGlzIHJlc2V0dGVkLlxyXG4gICAgICAgIHZhciBmaWx0ZXJzVG9SZWZyZXNoID0gdGhpcy5maWx0ZXJzXHJcbiAgICAgICAgICAgIC5maWx0ZXIoZnVuY3Rpb24gKGYpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmLmNvbHVtbiAhPT0gZmlsdGVyLmNvbHVtbjtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG5cclxuICAgICAgICBmaWx0ZXJzVG9SZWZyZXNoLmZvckVhY2goZnVuY3Rpb24gKGZpbHRlcikge1xyXG4gICAgICAgICAgICBmaWx0ZXIucmVmcmVzaCh0aGlzLmdldEZpbHRlcmVkQ29sdW1uRGF0YShmaWx0ZXIuY29sdW1uKSk7XHJcbiAgICAgICAgfSwgdGhpcyk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG59O1xyXG5cclxuRmlsdGVycy5wcm90b3R5cGUudXBkYXRlcnMub3RoZXJzID0gVXBkYXRlT3RoZXJzO1xyXG4iXX0=
