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
        this.$filterHeader = $('<tr class="datatable-filters-header"></tr>');

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
     * for specific filtering
     *
     * @param {String} value The option value
     *
     * @returns {Boolean} True if the value can be included in the filter options. False otherwise.
     */
    filterOptions: function (value) {
        return value.trim() != '';
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJqcy9iYXNlZmlsdGVyLmpzIiwianMvZmlsdGVycy5qcyIsImpzL2lucHV0L2lucHV0LmpzIiwianMvbWFpbi5qcyIsImpzL3JlbmRlcmVyL3NpbXBsZS5qcyIsImpzL3NlbGVjdC9iYXNlc2VsZWN0LmpzIiwianMvc2VsZWN0L2ZpeGVkc2VsZWN0LmpzIiwianMvc2VsZWN0L211bHRpc2VsZWN0LmpzIiwianMvc2VsZWN0L3JlbmRlcmVyL2Jvb3RzdHJhcC5qcyIsImpzL3NlbGVjdC9yZW5kZXJlci9jaG9zZW4uanMiLCJqcy9zZWxlY3Qvc2ltcGxlc2VsZWN0LmpzIiwianMvdXBkYXRlci91cGRhdGVOb25lLmpzIiwianMvdXBkYXRlci91cGRhdGVPdGhlcnMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNoSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUN0VEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMvREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDdEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ3pNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ3BEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUM3RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDdkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNoRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XHJcblxyXG4vKipcclxuICogQmFzZUZpbHRlclxyXG4gKi9cclxudmFyIEJhc2VGaWx0ZXIgPSB7XHJcblxyXG4gICAgaW5pdGlhbGl6ZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMuaW5pdCgpO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5jbGFzc05hbWUpIHtcclxuICAgICAgICAgICAgdGhpcy5hZGRDbGFzcyh0aGlzLmNsYXNzTmFtZSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAodGhpcy5hdHRycykge1xyXG4gICAgICAgICAgICB0aGlzLmFkZEF0dHJpYnV0ZXModGhpcy5hdHRycyk7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEByZXR1cm5zIHtCb29sZWFufSBXaGV0aGVyIGEgZmlsdGVyIGNoYW5nZSBtdXN0IHRyaWdnZXIgYSBkYXRhdGFibGUgcmVsb2FkLlxyXG4gICAgICogRGVmYXVsdCBpcyBmYWxzZSAoY2xpZW50IHNpZGUgZmlsdGVyKS5cclxuICAgICAqL1xyXG4gICAgaXNTZXJ2ZXJTaWRlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSByZXF1ZXN0IHBhcmFtZXRlciBhc3NvY2lhdGVkIHdpdGggdGhpcyBmaWx0ZXIgKGluIHRoZSBmb3JtIGtleT1wYXJhbSxcclxuICAgICAqIG9ubHkgdXNlZCBmb3Igc2VydmVyIHNpZGUgZmlsdGVycylcclxuICAgICAqL1xyXG4gICAgZ2V0U2VydmVyUXVlcnk6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gJyc7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogVHJpZ2dlcnMgYW4gdXBkYXRlIGV2ZW50XHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge0Jhc2VGaWx0ZXJ9IFRoZSBmaWx0ZXIgb2JqZWN0XHJcbiAgICAgKi9cclxuICAgIG5vdGlmeUNoYW5nZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMuJGRvbS50cmlnZ2VyKCd1cGRhdGUuZmlsdGVycy5kdCcsIHtcclxuICAgICAgICAgICAgZmlsdGVyOiB0aGlzXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBmaWx0ZXIgc3RyaW5nIHRvIGJlIGFwcGxpZWQgdG8gdGhlIGRhdGF0YWJsZSBjb2x1bW5cclxuICAgICAqL1xyXG4gICAgZ2V0UXVlcnk6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICBpZiAoIXRoaXMuaGFzVmFsdWUoKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5ub1NlbGVjdGlvblF1ZXJ5KCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gdGhpcy5zZWxlY3RlZFF1ZXJ5KCk7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVnaXN0ZXJzIGEgY2FsbGJhY2sgdG8gYmUgY2FsbGVkIHdoZW4gdGhlIHZhbHVlIG9mIHRoZSBmaWx0ZXIgY2hhbmdlc1xyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIFRoZSBhY3Rpb24gdG8gcGVyZm9ybSB3aGVuIHRoZSBmaWx0ZXIgdmFsdWUgY2hhbmdlc1xyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtCYXNlRmlsdGVyfSBUaGUgZmlsdGVyIG9iamVjdFxyXG4gICAgICovXHJcbiAgICByZWdpc3RlcjogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgdGhpcy4kZG9tLm9uKCd1cGRhdGUuZmlsdGVycy5kdCcsIGNhbGxiYWNrKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQWRkcyBhIGNzcyBjbGFzcyB0byB0aGUgZmlsdGVyIGNvbXBvbmVudFxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBjc3NDbGFzcyBUaGUgY3NzIGNsYXNzIHRvIGFkZFxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtCYXNlRmlsdGVyfSBUaGUgZmlsdGVyIG9iamVjdFxyXG4gICAgICovXHJcbiAgICBhZGRDbGFzczogZnVuY3Rpb24gKGNzc0NsYXNzKSB7XHJcbiAgICAgICAgdGhpcy4kZG9tLmFkZENsYXNzKGNzc0NsYXNzKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogU2V0cyB0aGUgZ2l2ZW4gdmFsdWVzIGFzIGF0dHJpYnV0ZXMgb2YgdGhlIGZpbHRlciBjb21wb25lbnRcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBhdHRycyBBbiBvYmplY3Qgb2YgYXR0cmlidXRlLXZhbHVlIHBhaXJzIHRvIHNldFxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtCYXNlRmlsdGVyfSBUaGUgZmlsdGVyIG9iamVjdFxyXG4gICAgICovXHJcbiAgICBhZGRBdHRyaWJ1dGVzOiBmdW5jdGlvbiAoYXR0cnMpIHtcclxuICAgICAgICB0aGlzLiRkb20uYXR0cihhdHRycyk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIFJlbW92ZSB0aGUgZmlsdGVyIGZyb20gdGhlIERPTS5cclxuICAgICAqIFJlc2V0IHRoZSBmaWx0ZXIncyB2YWx1ZSBiZWZvcmUgcmVtb3ZpbmcgdG8gZGlzYWJsZSBmaWx0ZXJpbmcgZm9yIHRoaXMgY29sdW1uLlxyXG4gICAgICovXHJcbiAgICByZW1vdmU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLnJlc2V0KCk7XHJcbiAgICAgICAgdGhpcy5ub3RpZnlDaGFuZ2UoKTtcclxuXHJcbiAgICAgICAgdGhpcy4kZG9tLnJlbW92ZSgpO1xyXG4gICAgICAgIGRlbGV0ZSB0aGlzLiRkb207XHJcbiAgICB9XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEJhc2VGaWx0ZXI7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJyQnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJyQnXSA6IG51bGwpO1xyXG5cclxuLyoqXHJcbiAqIEZpbHRlcnMgaXMgYSBjb21wb25lbnQgdGhhdCBtYW5hZ2VzIGEgbGlzdCBvZiBmaWx0ZXIgb2JqZWN0cyBpbnNpZGVcclxuICogYSBkYXRhdGFibGUgaGVhZGVyIHJvdy5cclxuICpcclxuICogVGhpcyBjb25zdHJ1Y3RvciBiaW5kcyBsaXN0ZW5lcnMgdG8gdmFyaW91cyBkYXRhdGFibGUgZXZlbnRzLlxyXG4gKlxyXG4gKiBAcGFyYW0ge09iamVjdH0gc2V0dGluZ3Mgb2JqZWN0IHVzZWQgdG8gY3JlYXRlIHRoZSBkYXRhdGFibGVcclxuICovXHJcbnZhciBGaWx0ZXJzID0gZnVuY3Rpb24gKHNldHRpbmdzKSB7XHJcbiAgICB0aGlzLnNldHRpbmdzID0gc2V0dGluZ3M7XHJcbiAgICB0aGlzLnRhYmxlQVBJID0gbmV3ICQuZm4uZGF0YVRhYmxlLkFwaShzZXR0aW5ncyk7XHJcbiAgICB0aGlzLiRoZWFkZXIgPSAkKHRoaXMudGFibGVBUEkudGFibGUoKS5oZWFkZXIoKSk7XHJcbiAgICB0aGlzLnVybCA9IHRoaXMudGFibGVBUEkuYWpheC51cmwoKTtcclxuXHJcbiAgICB0aGlzLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgdGhpcy5kZWZhdWx0U2V0dGluZ3MsIHRoaXMudGFibGVBUEkuaW5pdCgpLmZpbHRlcnMpO1xyXG4gICAgJC5leHRlbmQodGhpcywgdGhpcy51cGRhdGVyc1t0aGlzLm9wdGlvbnMudXBkYXRlcl0pO1xyXG5cclxuICAgIHRoaXMuZmlsdGVycyA9IHNldHRpbmdzLmFvQ29sdW1ucy5maWx0ZXIoZnVuY3Rpb24gKHBhcmFtKSB7XHJcbiAgICAgICAgcmV0dXJuIHBhcmFtLmZpbHRlcjtcclxuICAgIH0pLm1hcChmdW5jdGlvbiAocGFyYW0pIHtcclxuICAgICAgICB2YXIgb3B0aW9ucyA9ICQuZXh0ZW5kKHtcclxuICAgICAgICAgICAgY29sdW1uOiBwYXJhbS5pZHgsXHJcbiAgICAgICAgICAgIHJlbmRlckNvbHVtbjogdGhpcy50YWJsZUFQSS5jb2x1bW4uaW5kZXgoJ3RvVmlzaWJsZScsIHBhcmFtLmlkeClcclxuICAgICAgICB9LCBwYXJhbS5maWx0ZXIpO1xyXG5cclxuICAgICAgICB2YXIgZmlsdGVyID0gdGhpcy5idWlsZGVyc1twYXJhbS5maWx0ZXIudHlwZV0ob3B0aW9ucyk7XHJcblxyXG4gICAgICAgIGZpbHRlci5pbml0aWFsaXplKCk7XHJcblxyXG4gICAgICAgIHRoaXMuYXBwbHlGaWx0ZXIoZmlsdGVyKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIGZpbHRlcjtcclxuICAgIH0sIHRoaXMpO1xyXG5cclxuICAgIGlmICh0aGlzLmZpbHRlcnMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIHRoaXMudGFibGVBUEkub24oJ2luaXQnLCB0aGlzLm9uRGF0YVRhYmxlSW5pdC5iaW5kKHRoaXMpKTtcclxuICAgIH1cclxufTtcclxuXHJcbkZpbHRlcnMucHJvdG90eXBlID0ge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQXJyYXkgb2YgZmlsdGVyIGNvbnN0cnVjdG9yIGZ1bmN0aW9uLiBFYWNoIGZ1bmN0aW9uXHJcbiAgICAgKiB0YWtlcyBhIHNldHRpbmcgb2JqZWN0IGFzIGl0cyBzaW5nbGUgcGFyYW1ldGVyXHJcbiAgICAgKi9cclxuICAgIGJ1aWxkZXJzOiB7fSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEFycmF5IG9mIHVwZGF0ZXIgY29uc3RydWN0b3IgZnVuY3Rpb24uXHJcbiAgICAgKiBFYWNoIGZ1bmN0aW9uIHRha2VzIHRoZSBmaWx0ZXIgdG8gdXBkYXRlIGFzIGl0cyBzaW5nbGUgcGFyYW1ldGVyXHJcbiAgICAgKi9cclxuICAgIHVwZGF0ZXJzOiB7fSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEFycmF5IG9mIGRlZmF1bHQgc2V0dGluZ3MgZm9yIHRoZSBGaWx0ZXIgb2JqZWN0XHJcbiAgICAgKi9cclxuICAgIGRlZmF1bHRTZXR0aW5nczoge1xyXG4gICAgICAgIHVwZGF0ZXI6ICdub25lJ1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIFJlZnJlc2hlcyBmaWx0ZXJzIGFmdGVyIGVhY2ggYWpheCByZXF1ZXN0XHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge0ZpbHRlcnN9IFRoZSBGaWx0ZXJzIG9iamVjdFxyXG4gICAgICovXHJcbiAgICByZWdpc3RlckFqYXhMaXN0ZW5lcjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMudGFibGVBUEkub24oJ3hocicsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdGhpcy50YWJsZUFQSS5vbmUoJ3ByZURyYXcnLCB0aGlzLnJlZnJlc2hGaWx0ZXJzLmJpbmQodGhpcykpO1xyXG4gICAgICAgIH0uYmluZCh0aGlzKSk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEluaXRpYWxpemVzIHRoZSBoZWFkZXIgSFRNTCBlbGVtZW50cyB0aGF0IHdpbGwgYmUgdXNlZCB0byBob2xkIHRoZSBmaWx0ZXJzLlxyXG4gICAgICogSXQgYWxzbyByZWdpc3RlcnMgdGhlIG1haW4gZXZlbnQgaGFuZGxlciB0aGF0IHdpbGwgcmVhY3QgdG8gdGhlIGZpbHRlcnMnXHJcbiAgICAgKiB2YWx1ZSBjaGFuZ2VzLlxyXG4gICAgICpcclxuICAgICAqIFRoZSBldmVudCBuYW1lIGlzIDxiPmZpbHRlckNoYW5nZTwvYj4uIFRoaXMgZXZlbnQgbXVzdCBiZSB0cmlnZ2VyZWQgYnkgdGhlXHJcbiAgICAgKiBmaWx0ZXJzIHdoZW4gdGhlaXIgdmFsdWUgaXMgbW9kaWZpZWQgYnkgdGhlIHVzZXIgKG9yIGFueSBvdGhlciBldmVudCB0aGF0XHJcbiAgICAgKiBzaG91bGQgdHJpZ2dlciBhIGRhdGF0YWJsZSBmaWx0ZXIpLlxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJzfSBUaGUgRmlsdGVycyBvYmplY3RcclxuICAgICAqL1xyXG4gICAgc2V0dXBIZWFkZXJSb3c6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLiRmaWx0ZXJIZWFkZXIgPSAkKCc8dHIgY2xhc3M9XCJkYXRhdGFibGUtZmlsdGVycy1oZWFkZXJcIj48L3RyPicpO1xyXG5cclxuICAgICAgICB0aGlzLnNldHRpbmdzLmFvQ29sdW1ucy5maWx0ZXIoZnVuY3Rpb24gKGNvbHVtbikge1xyXG4gICAgICAgICAgICByZXR1cm4gY29sdW1uLmJWaXNpYmxlO1xyXG4gICAgICAgIH0pXHJcbiAgICAgICAgLmZvckVhY2goZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB0aGlzLiRmaWx0ZXJIZWFkZXIuYXBwZW5kKCc8dGg+PC90aD4nKTtcclxuICAgICAgICB9LCB0aGlzKTtcclxuXHJcbiAgICAgICAgdGhpcy4kaGVhZGVyLmFwcGVuZCh0aGlzLiRmaWx0ZXJIZWFkZXIpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZWRyYXdzIHRoZSBkYXRhdGFibGVcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7RmlsdGVyc30gVGhlIEZpbHRlcnMgb2JqZWN0XHJcbiAgICAgKi9cclxuICAgIGRyYXdUYWJsZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMudGFibGVBUEkuZHJhdygpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXRyaWV2ZXMgdGhlIGNvbHVtbiBkYXRhIChjdXJyZW50IGZpbHRlciBpcyBpZ25vcmVkKVxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSB7aW50fSBjb2wgVGhlIGNvbHVtbiBpbmRleCAoMCBiYXNlZClcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJuIHtqUXVlcnl9IFRoZSB1bmZpbHRlcmVkIGNvbHVtbiByZW5kZXJlZCBkYXRhXHJcbiAgICAgKi9cclxuICAgIGdldENvbHVtbkRhdGE6IGZ1bmN0aW9uIChjb2wpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy50YWJsZUFQSS5jb2x1bW4oY29sKS5kYXRhKCkudW5pcXVlKCk7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmV0cmlldmVzIHRoZSBjb2x1bW4gZmlsdGVyZWQgZGF0YVxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSB7aW50fSBjb2wgVGhlIGNvbHVtbiBpbmRleCAoMCBiYXNlZClcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJuIHtqUXVlcnl9IFRoZSBmaWx0ZXJlZCBjb2x1bW4gZGF0YVxyXG4gICAgICovXHJcbiAgICBnZXRGaWx0ZXJlZENvbHVtbkRhdGE6IGZ1bmN0aW9uIChjb2wpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy50YWJsZUFQSS5jb2x1bW4oY29sLCB7c2VhcmNoOiAnYXBwbGllZCd9KS5kYXRhKCkudW5pcXVlKCk7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQWN0aW9ucyB0byBleGVjdXRlIHdoZW4gdGhlIGRhdGF0YWJsZSBpcyBkb25lIGluaXRpYWxpemluZy5cclxuICAgICAqIENyZWF0ZXMgdGhlIGZpbHRlciBoZWFkZXIgcm93LCByZWdpc3RlcnMgYWpheCBsaXN0ZW5lcnMgYW5kXHJcbiAgICAgKiByZW5kZXJzIGZpbHRlcnNcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7RmlsdGVyc30gVGhlIEZpbHRlcnMgb2JqZWN0XHJcbiAgICAgKi9cclxuICAgIG9uRGF0YVRhYmxlSW5pdDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMuc2V0dXBIZWFkZXJSb3coKS5yZWdpc3RlckFqYXhMaXN0ZW5lcigpLnJlbmRlckZpbHRlcnMoKTtcclxuXHJcbiAgICAgICAgdGhpcy50YWJsZUFQSS5vbiggJ2NvbHVtbi12aXNpYmlsaXR5LmR0JywgZnVuY3Rpb24gKCBlLCBzZXR0aW5ncywgY29sdW1uLCB2aXNpYmxlICkge1xyXG4gICAgICAgICAgICAvLyBGaW5kIHRoZSBmaWx0ZXIgYXNzb2NpYXRlZCB0byB0aGUgY29sdW1uXHJcbiAgICAgICAgICAgIHZhciBmaWx0ZXIgPSB0aGlzLmZpbHRlcnMuZmluZChmdW5jdGlvbiAoZmlsdGVyKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmlsdGVyLmNvbHVtbiA9PT0gY29sdW1uO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIC8vIEZpbmQgdGhlIGNvbHVtbiBpbmRleCBpbnRvIHRoZSBET01cclxuICAgICAgICAgICAgdmFyIHJlbmRlckNvbHVtbiA9IHNldHRpbmdzLmFvQ29sdW1ucy5zbGljZSgwLCBjb2x1bW4pXHJcbiAgICAgICAgICAgIC5yZWR1Y2UoZnVuY3Rpb24gKGFjYywgY29sdW1uKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gY29sdW1uLmJWaXNpYmxlID8gYWNjICsgMSA6IGFjYztcclxuICAgICAgICAgICAgfSwgMCk7XHJcblxyXG4gICAgICAgICAgICBpZih2aXNpYmxlKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNyZWF0ZUZpbHRlcldyYXBwZXIocmVuZGVyQ29sdW1uKTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZihmaWx0ZXIpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBGSVg6IGlmIGEgZmlsdGVyIHdhcyBoaWRkZW4gYXQgdGhlIHN0YXJ0dXAsIHNvIGl0IGRvZXNuJ3QgaGF2ZSByZW5kZXJDb2x1bW4gc2V0dGVkLFxyXG4gICAgICAgICAgICAgICAgICAgIC8vIFNvIHdlIG5lZWQgdG8gcmUtY29tcHV0ZSBpdFxyXG4gICAgICAgICAgICAgICAgICAgIGZpbHRlci5yZW5kZXJDb2x1bW4gPSB0aGlzLnRhYmxlQVBJLmNvbHVtbi5pbmRleCgndG9WaXNpYmxlJywgZmlsdGVyLmNvbHVtbik7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGZpbHRlci5pbml0aWFsaXplKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJGaWx0ZXIoZmlsdGVyKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGlmKGZpbHRlcikge1xyXG4gICAgICAgICAgICAgICAgICAgIGZpbHRlci5yZW1vdmUoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICB0aGlzLnJlbW92ZUZpbHRlcldyYXBwZXIocmVuZGVyQ29sdW1uKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0uYmluZCh0aGlzKSk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIFdoZW4gYSBjbGllbnQtc2lkZSBmaWx0ZXIgY2hhbmdlcywgYXBwbGllcyBpdHMgbmV3IHZhbHVlXHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtIHtFdmVudH0gZXZlbnQgVGhlIGV2ZW50IG9iamVjdFxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHBhcmFtcyBUaGUgZXZlbnQgcGFyYW1zXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybiB7RmlsdGVyc30gVGhlIEZpbHRlcnMgb2JqZWN0XHJcbiAgICAgKi9cclxuICAgIG9uQ2xpZW50RmlsdGVyQ2hhbmdlOiBmdW5jdGlvbiAoZXZlbnQsIHBhcmFtcykge1xyXG4gICAgICAgIHRoaXMuYXBwbHlGaWx0ZXIocGFyYW1zLmZpbHRlcilcclxuICAgICAgICAgICAgLnJlZnJlc2hBbGxGaWx0ZXJzKHBhcmFtcy5maWx0ZXIpXHJcbiAgICAgICAgICAgIC5kcmF3VGFibGUoKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogV2hlbiBhIHNlcnZlci1zaWRlIGZpbHRlciBjaGFuZ2VzLCBidWlsZHMgdGhlIG5ldyBhamF4IHF1ZXJ5IGFuZCByZWZyZXNoZXMgdGhlIHRhYmxlXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybiB7RmlsdGVyc30gVGhlIEZpbHRlcnMgb2JqZWN0XHJcbiAgICAgKi9cclxuICAgIG9uU2VydmVyRmlsdGVyQ2hhbmdlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIHNlcnZlclF1ZXJ5ID0gdGhpcy5maWx0ZXJzLmZpbHRlcihmdW5jdGlvbiAoZmlsdGVyKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmaWx0ZXIuaXNTZXJ2ZXJTaWRlKCk7XHJcbiAgICAgICAgfSkubWFwKGZ1bmN0aW9uIChmaWx0ZXIpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGZpbHRlci5nZXRTZXJ2ZXJRdWVyeSgpO1xyXG4gICAgICAgIH0pLmpvaW4oJyYnKTtcclxuXHJcbiAgICAgICAgdGhpcy50YWJsZUFQSS5hamF4LnVybCh0aGlzLnVybCArICc/JyArIHNlcnZlclF1ZXJ5KS5hamF4LnJlbG9hZCgpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBBcHBsaWVzIHRoZSBmaWx0ZXIgdmFsdWUgdG8gdGhlIHJlbGF0ZWQgY29sdW1uXHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtIHtCYXNlRmlsdGVyfSBmaWx0ZXIgVGhlIGZpbHRlciBvYmplY3RcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJuIHtGaWx0ZXJzfSBUaGUgRmlsdGVycyBvYmplY3RcclxuICAgICAqL1xyXG4gICAgYXBwbHlGaWx0ZXI6IGZ1bmN0aW9uIChmaWx0ZXIpIHtcclxuICAgICAgICB0aGlzLnRhYmxlQVBJLmNvbHVtbihmaWx0ZXIuY29sdW1uKS5zZWFyY2goXHJcbiAgICAgICAgICAgIGZpbHRlci5nZXRRdWVyeSgpLFxyXG4gICAgICAgICAgICBmaWx0ZXIuaXNSZWdleE1hdGNoKClcclxuICAgICAgICAgICAgLCBmYWxzZSk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEBzZWUgdGhpcy5yZW5kZXJGaWx0ZXJcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7RmlsdGVyc30gVGhlIEZpbHRlcnMgb2JqZWN0XHJcbiAgICAgKi9cclxuICAgIHJlbmRlckZpbHRlcnM6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLmZpbHRlcnMuZm9yRWFjaCh0aGlzLnJlbmRlckZpbHRlciwgdGhpcyk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEFza3MgYSBmaWx0ZXIgdG8gcmVuZGVyIGl0c2VsZiBhbmQgcHJvdmlkZXMgYW4gb3B0aW9uYWwgY29udGFpbmVyXHJcbiAgICAgKiBmb3IgZmlsdGVycyB0aGF0IG5lZWQgdG8gYmUgcmVuZGVyZWQgaW5zaWRlIHRoZSBkYXRhdGFibGUgaGVhZGVyIHJvd1xyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSB7QmFzZUZpbHRlcn0gZmlsdGVyIFRoZSBmaWx0ZXIgb2JqZWN0XHJcbiAgICAgKi9cclxuICAgIHJlbmRlckZpbHRlcjogZnVuY3Rpb24gKGZpbHRlcikge1xyXG4gICAgICAgIHZhciBjb2wgPSBmaWx0ZXIuY29sdW1uO1xyXG4gICAgICAgIHZhciAkY29sSGVhZGVyID0gJCh0aGlzLnRhYmxlQVBJLmNvbHVtbihjb2wpLmhlYWRlcigpKTtcclxuICAgICAgICB2YXIgJGNvbnRhaW5lciA9IHRoaXMuJGhlYWRlci5maW5kKCcuZGF0YXRhYmxlLWZpbHRlcnMtaGVhZGVyIHRoOmVxKCcgKyBmaWx0ZXIucmVuZGVyQ29sdW1uICsgJyknKTtcclxuXHJcbiAgICAgICAgaWYgKGZpbHRlci5pc1NlcnZlclNpZGUoKSkge1xyXG4gICAgICAgICAgICBmaWx0ZXIucmVnaXN0ZXIodGhpcy5vblNlcnZlckZpbHRlckNoYW5nZS5iaW5kKHRoaXMpKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBmaWx0ZXIucmVnaXN0ZXIodGhpcy5vbkNsaWVudEZpbHRlckNoYW5nZS5iaW5kKHRoaXMpKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZpbHRlci5yZW5kZXIoJGNvbnRhaW5lciwgJGNvbEhlYWRlci5odG1sKCksIHRoaXMuZ2V0Q29sdW1uRGF0YShjb2wpKTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZWZyZXNoZXMgdGhlIGZpbHRlcnMgYmFzZWQgb24gdGhlIGN1cnJlbnRseSBkaXNwbGF5ZWQgZGF0YSBmb3IgZWFjaCBjb2x1bW5cclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJuIHtGaWx0ZXJzfSBUaGUgRmlsdGVycyBvYmplY3RcclxuICAgICAqL1xyXG4gICAgcmVmcmVzaEZpbHRlcnM6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLmZpbHRlcnMuZm9yRWFjaChmdW5jdGlvbiAoZmlsdGVyKSB7XHJcbiAgICAgICAgICAgIGZpbHRlci5yZWZyZXNoKHRoaXMuZ2V0Q29sdW1uRGF0YShmaWx0ZXIuY29sdW1uKSk7XHJcbiAgICAgICAgICAgIHRoaXMuYXBwbHlGaWx0ZXIoZmlsdGVyKTtcclxuICAgICAgICB9LCB0aGlzKTtcclxuXHJcbiAgICAgICAgdGhpcy5kcmF3VGFibGUoKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlIGEgZmlsdGVyJ3MgaGVhZGVyIGNlbGxcclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCB0aGUgaW5kZXggb2YgdGhlIGNlbGwgdG8gY3JlYXRlXHJcbiAgICAgKiBAcmV0dXJuIHtGaWx0ZXJzfSBUaGUgRmlsdGVycyBvYmplY3RcclxuICAgICAqL1xyXG4gICAgY3JlYXRlRmlsdGVyV3JhcHBlcjogZnVuY3Rpb24gKGluZGV4KSB7XHJcbiAgICAgICAgaWYoaW5kZXggPT09IDApIHtcclxuICAgICAgICAgICAgdGhpcy4kZmlsdGVySGVhZGVyLnByZXBlbmQoJzx0aC8+Jyk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy4kZmlsdGVySGVhZGVyLmZpbmQoJ3RoOmVxKCcgKyAoaW5kZXggLSAxKSArICcpJylcclxuICAgICAgICAgICAgLmFmdGVyKCc8dGgvPicpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVtb3ZlIGEgZmlsdGVyJ3MgaGVhZGVyIGNlbGxcclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCB0aGUgaW5kZXggb2YgdGhlIGNlbGwgdG8gcmVtb3ZlXHJcbiAgICAgKiBAcmV0dXJuIHtGaWx0ZXJzfSBUaGUgRmlsdGVycyBvYmplY3RcclxuICAgICAqL1xyXG4gICAgcmVtb3ZlRmlsdGVyV3JhcHBlcjogZnVuY3Rpb24gKGluZGV4KSB7XHJcbiAgICAgICAgdGhpcy4kZmlsdGVySGVhZGVyLmZpbmQoJ3RoOmVxKCcgKyBpbmRleCArICcpJykucmVtb3ZlKCk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG59O1xyXG5cclxuJChkb2N1bWVudCkub24oJ3ByZUluaXQuZHQnLCBmdW5jdGlvbiAoZSwgc2V0dGluZ3MpIHtcclxuICAgIG5ldyBGaWx0ZXJzKHNldHRpbmdzKTtcclxufSk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEZpbHRlcnM7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJyQnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJyQnXSA6IG51bGwpO1xyXG52YXIgQmFzZUZpbHRlciA9IHJlcXVpcmUoJy4uL2Jhc2VmaWx0ZXInKTtcclxudmFyIFNpbXBsZVJlbmRlcmVyID0gcmVxdWlyZSgnLi4vcmVuZGVyZXIvc2ltcGxlJyk7XHJcbnZhciBGaWx0ZXJzID0gcmVxdWlyZSgnLi4vZmlsdGVycycpO1xyXG5cclxudmFyIElucHV0RmlsdGVyID0gJC5leHRlbmQoe30sIEJhc2VGaWx0ZXIsIFNpbXBsZVJlbmRlcmVyLCB7XHJcblxyXG4gICAgaW5pdDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMuJGRvbSA9ICQoJzxpbnB1dCBjbGFzcz1cImZpbHRyZVwiLz4nKTtcclxuICAgICAgICB0aGlzLiRkb20udmFsKHRoaXMuZ2V0SW5pdGlhbFF1ZXJ5KCkpO1xyXG4gICAgICAgIHRoaXMuJGRvbS5vbignaW5wdXQnLCB0aGlzLm5vdGlmeUNoYW5nZS5iaW5kKHRoaXMpKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIHBvcHVsYXRlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIHVwZGF0ZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICBub1NlbGVjdGlvblF1ZXJ5OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuICcnO1xyXG4gICAgfSxcclxuXHJcbiAgICBpc1JlZ2V4TWF0Y2g6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH0sXHJcblxyXG4gICAgaGFzVmFsdWU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy4kZG9tLnZhbCgpICE9ICcnO1xyXG4gICAgfSxcclxuXHJcbiAgICBzZWxlY3RlZFF1ZXJ5OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuJGRvbS52YWwoKTtcclxuICAgIH0sXHJcblxyXG4gICAgZ2V0SW5pdGlhbFF1ZXJ5OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuICcnO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAgKiBSZXNldCB0aGUgZmlsdGVyJ3MgaW5wdXQsXHJcbiAgICAgICogc28gdGhlIGZpbHRlciB3aWxsIGtlZXAgZXZlcnkgcm93c1xyXG4gICAgICAqIEByZXR1cm5zIHtJbnB1dEZpbHRlcn0gVGhlIEZpbHRlciBvYmplY3RcclxuICAgICAgKi9cclxuICAgIHJlc2V0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy4kZG9tLnZhbCgnJyk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG5cclxufSk7XHJcblxyXG5GaWx0ZXJzLnByb3RvdHlwZS5idWlsZGVycy5pbnB1dCA9IGZ1bmN0aW9uIChzZXR0aW5ncykge1xyXG4gICAgcmV0dXJuICQuZXh0ZW5kKHt9LCBJbnB1dEZpbHRlciwgc2V0dGluZ3MpO1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBJbnB1dEZpbHRlcjtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxucmVxdWlyZSgnLi91cGRhdGVyL3VwZGF0ZU5vbmUnKTtcclxucmVxdWlyZSgnLi91cGRhdGVyL3VwZGF0ZU90aGVycycpO1xyXG5yZXF1aXJlKCcuL3NlbGVjdC9zaW1wbGVzZWxlY3QnKTtcclxucmVxdWlyZSgnLi9zZWxlY3QvbXVsdGlzZWxlY3QnKTtcclxucmVxdWlyZSgnLi9zZWxlY3QvZml4ZWRzZWxlY3QnKTtcclxucmVxdWlyZSgnLi9pbnB1dC9pbnB1dCcpO1xyXG5yZXF1aXJlKCcuL2ZpbHRlcnMnKTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIFNpbXBsZVJlbmRlcmVyID0ge1xyXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoJGNvbnRhaW5lciwgaGVhZGVyLCBkYXRhKSB7XHJcbiAgICAgICAgdGhpcy5wb3B1bGF0ZShkYXRhKTtcclxuICAgICAgICB0aGlzLnNob3dGaWx0ZXIodGhpcy4kZG9tLCAkY29udGFpbmVyLCBoZWFkZXIsIGRhdGEpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgc2hvd0ZpbHRlcjogZnVuY3Rpb24oJGRvbSwgJGNvbnRhaW5lciwgaGVhZGVyKSB7XHJcbiAgICAgICAgJGNvbnRhaW5lci5hcHBlbmQodGhpcy4kZG9tKTtcclxuICAgICAgICB0aGlzLiRkb20uYXR0cignbmFtZScsIGhlYWRlcikuYXR0cigncGxhY2Vob2xkZXInLCBoZWFkZXIpLnNob3coKTtcclxuICAgIH0sXHJcblxyXG4gICAgcmVmcmVzaDogZnVuY3Rpb24gKGRhdGEpIHtcclxuICAgICAgICB0aGlzLnVwZGF0ZShkYXRhKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFNpbXBsZVJlbmRlcmVyOyIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJyQnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJyQnXSA6IG51bGwpO1xyXG52YXIgQmFzZUZpbHRlciA9IHJlcXVpcmUoJy4uL2Jhc2VmaWx0ZXInKTtcclxudmFyIFNpbXBsZVJlbmRlcmVyID0gcmVxdWlyZSgnLi4vcmVuZGVyZXIvc2ltcGxlJyk7XHJcbnZhciBCb290c3RyYXBSZW5kZXJlciA9IHJlcXVpcmUoJy4vcmVuZGVyZXIvYm9vdHN0cmFwJyk7XHJcbnZhciBDaG9zZW5SZW5kZXIgPSByZXF1aXJlKCcuL3JlbmRlcmVyL2Nob3NlbicpO1xyXG5cclxuLyoqXHJcbiAqIFNlbGVjdEZpbHRlciByZWdyb3VwcyBjb21tb24gYmVoYXZpb3IgZm9yIHNlbGVjdCBmaWx0ZXJzXHJcbiAqL1xyXG52YXIgU2VsZWN0RmlsdGVyID0gJC5leHRlbmQoe30sIEJhc2VGaWx0ZXIsIHtcclxuICAgIHNlbGVjdGVkOiBbXSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgYW4gYWx3YXlzIGZhbHNlIHJlZ2V4IHRvIGhpZGUgZXZlcnkgcmVjb3Jkc1xyXG4gICAgICogd2hlbiBubyBvcHRpb24gaXMgc2VsZWN0ZWRcclxuICAgICAqL1xyXG4gICAgbm9TZWxlY3Rpb25RdWVyeTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiAnJC5eJztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZS4gU2VsZWN0IGZpbHRlcnMgYWx3YXlzIHVzZSByZWdleFxyXG4gICAgICovXHJcbiAgICBpc1JlZ2V4TWF0Y2g6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyB0cnVlIGlmIGF0IGxlYXN0IG9uZSBvcHRpb24gaXMgc2VsZWN0ZWRcclxuICAgICAqL1xyXG4gICAgaGFzVmFsdWU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fZ2V0U2VsZWN0aW9uKCkubGVuZ3RoID4gMDtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgY29sdW1uIGZpbHRlciBxdWVyeSB0byBhcHBseS4gU2VsZWN0ZWQgb3B0aW9uIHZhbHVlc1xyXG4gICAgICogYXJlIGNvbmNhdGVuYXRlZCBpbnRvIGEgc3RyaW5nIHVzaW5nIHRoZSBwaXBlIGNoYXJhY3RlciAocmVnZXggb3IpXHJcbiAgICAgKi9cclxuICAgIHNlbGVjdGVkUXVlcnk6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fZ2V0U2VsZWN0aW9uKCkubWFwKGZ1bmN0aW9uICh2YWx1ZSkge1xyXG4gICAgICAgICAgICBpZiAodmFsdWUgPT0gdGhpcy5hbGxUZXh0IHx8IHRoaXMuX2dldE5vdFNlbGVjdGVkKCkubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gJyc7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gJ14nICsgJC5mbi5kYXRhVGFibGUudXRpbC5lc2NhcGVSZWdleCh2YWx1ZSkgKyAnJCc7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LCB0aGlzKS5qb2luKCd8Jyk7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRmlsdGVycyB0aGUgb3B0aW9ucyBiZWZvcmUgYWRkaW5nIHRoZW0gdG8gdGhlIHNlbGVjdC4gQ2FuIGJlIG92ZXJyaWRkZW5cclxuICAgICAqIGZvciBzcGVjaWZpYyBmaWx0ZXJpbmdcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gdmFsdWUgVGhlIG9wdGlvbiB2YWx1ZVxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtCb29sZWFufSBUcnVlIGlmIHRoZSB2YWx1ZSBjYW4gYmUgaW5jbHVkZWQgaW4gdGhlIGZpbHRlciBvcHRpb25zLiBGYWxzZSBvdGhlcndpc2UuXHJcbiAgICAgKi9cclxuICAgIGZpbHRlck9wdGlvbnM6IGZ1bmN0aW9uICh2YWx1ZSkge1xyXG4gICAgICAgIHJldHVybiB2YWx1ZS50cmltKCkgIT0gJyc7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICAqIFJlc2V0IHRoZSBmaWx0ZXIgYnkgc2VsZWN0IG5vbmUgb3B0aW9uLFxyXG4gICAgICAqIHNvIHRoZSBmaWx0ZXIgd2lsbCBrZWVwIGV2ZXJ5IHJvd3NcclxuICAgICAgKiBAcmV0dXJucyB7U2VsZWN0RmlsdGVyfSBUaGUgRmlsdGVyIG9iamVjdFxyXG4gICAgICAqL1xyXG4gICAgcmVzZXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLiRkb20uZmluZCgnb3B0aW9uJykucmVtb3ZlQXR0cignc2VsZWN0ZWQnKTtcclxuICAgICAgICB0aGlzLl9zYXZlU2VsZWN0aW9uKCk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIFNvcnQgdGhlIG9wdGlvbnMgYmVmb3JlIGFkZGluZyB0aGVtIHRvIHRoZSBzZWxlY3QuIENhbiBiZSBvdmVycmlkZGVuIGZvclxyXG4gICAgICogc3BlY2lmaWMgc29ydHNcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gYSBUaGUgZmlyc3QgdmFsdWUgdG8gY29tcGFyZVxyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGIgVGhlIHNlY29uZCB2YWx1ZSB0byBjb21wYXJlXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybiB7SW50ZWdlcn0gMCBpZiB0aGUgdHdvIHZhbHVlcyBhcmUgZXF1YWwsIDEgaWYgYSA+IGIgYW5kIC0xIGlmIGEgPCBiXHJcbiAgICAgKi9cclxuICAgIHNvcnRPcHRpb25zOiBmdW5jdGlvbiAoYSwgYikge1xyXG4gICAgICAgIGlmIChhID4gYikge1xyXG4gICAgICAgICAgICByZXR1cm4gMTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChhIDwgYikge1xyXG4gICAgICAgICAgICByZXR1cm4gLTE7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gMDtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAcmV0dXJucyB7QXJyYXk8U3RyaW5nPn0gVGhlIGFycmF5IG9mIHNlbGVjdGVkIHZhbHVlc1xyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqL1xyXG4gICAgX2dldFNlbGVjdGlvbjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLiRkb20uZmluZCgnb3B0aW9uOnNlbGVjdGVkJykudG9BcnJheSgpLm1hcChmdW5jdGlvbiAob3B0aW9uKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBvcHRpb24udmFsdWU7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHsqfEFycmF5fSBUaGUgYXJyYXkgb2Ygbm9uIHNlbGVjdGVkIHZhbHVlc1xyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqL1xyXG4gICAgX2dldE5vdFNlbGVjdGVkOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuJGRvbS5maW5kKCc6bm90KG9wdGlvbjpzZWxlY3RlZCknKS50b0FycmF5KCkubWFwKGZ1bmN0aW9uIChvcHRpb24pIHtcclxuICAgICAgICAgICAgcmV0dXJuIG9wdGlvbi52YWx1ZTtcclxuICAgICAgICB9KTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBGb3IgZWFjaCBlbGVtZW50IGluIHRoZSBkYXRhIG9iamVjdCwgY3JlYXRlcyBhbiBvcHRpb24gZWxlbWVudCB1c2luZyB0aGUgZnVuY3Rpb25cclxuICAgICAqIGZuQ3JlYXRlXHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtIHtqUXVlcnl9IGRhdGEgVGhlIGRhdGEgdG8gYWRkIHRvIHRoZSBzZWxlY3RcclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGZuQ3JlYXRlIFRoZSBmdW5jdGlvbiB0byB1c2UgdG8gY3JlYXRlIHRoZSBvcHRpb25zXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICovXHJcbiAgICBfYWRkT3B0aW9uczogZnVuY3Rpb24gKGRhdGEsIGZuQ3JlYXRlKSB7XHJcbiAgICAgICAgdGhpcy4kZG9tLmVtcHR5KCk7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLmFsbFRleHQpXHJcbiAgICAgICAgICAgIGZuQ3JlYXRlLmNhbGwodGhpcywgdGhpcy5hbGxUZXh0KTtcclxuXHJcbiAgICAgICAgZGF0YS50b0FycmF5KCkuZmlsdGVyKHRoaXMuZmlsdGVyT3B0aW9ucykuc29ydCh0aGlzLnNvcnRPcHRpb25zKS5mb3JFYWNoKGZuQ3JlYXRlLCB0aGlzKTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGEgc2VsZWN0ZWQgb3B0aW9uXHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHZhbHVlIFRoZSBvcHRpb24gdmFsdWVcclxuICAgICAqIEBwcml2YXRlXHJcbiAgICAgKi9cclxuICAgIF9hZGRTZWxlY3RlZE9wdGlvbjogZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICAgICAgdGhpcy4kZG9tLmFwcGVuZCgkKCc8b3B0aW9uLz4nKVxyXG4gICAgICAgICAgICAgICAgLnZhbCh2YWx1ZSlcclxuICAgICAgICAgICAgICAgIC50ZXh0KHZhbHVlKVxyXG4gICAgICAgICAgICAgICAgLmF0dHIoJ3NlbGVjdGVkJywgJ3NlbGVjdGVkJylcclxuICAgICAgICApO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYW4gb3B0aW9uIHdpdGggdGhlIHNlbGVjdGVkIGZsYWcgYmFzZWQgb24gdGhlXHJcbiAgICAgKiBjdXJyZW50IGZpbHRlciBzdGF0ZVxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSB2YWx1ZSBUaGUgb3B0aW9uIHZhbHVlXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICovXHJcbiAgICBfcmVmcmVzaE9wdGlvbjogZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICAgICAgdmFyICRvcHRpb24gPSAkKCc8b3B0aW9uLz4nKVxyXG4gICAgICAgICAgICAudmFsKHZhbHVlKVxyXG4gICAgICAgICAgICAudGV4dCh2YWx1ZSk7XHJcblxyXG4gICAgICAgIGlmICgkLmluQXJyYXkodmFsdWUsIHRoaXMuc2VsZWN0ZWQpID4gLTEpXHJcbiAgICAgICAgICAgICRvcHRpb24uYXR0cignc2VsZWN0ZWQnLCAnc2VsZWN0ZWQnKTtcclxuXHJcbiAgICAgICAgdGhpcy4kZG9tLmFwcGVuZCgkb3B0aW9uKTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUYWtlcyBhIHNuYXBzaG90IG9mIHRoZSBjdXJyZW50IHNlbGVjdGlvbiBzdGF0ZVxyXG4gICAgICpcclxuICAgICAqIEBwcml2YXRlXHJcbiAgICAgKi9cclxuICAgIF9zYXZlU2VsZWN0aW9uOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy5zZWxlY3RlZCA9IHRoaXMuX2dldFNlbGVjdGlvbigpO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIFdoZW5ldmVyIHRoZSBzZWxlY3Qgc3RhdGUgY2hhbmdlcywgc2F2ZSBpdHMgbmV3IHN0YXRlIGFuZFxyXG4gICAgICogbm90aWZ5IHRoZSBsaXN0ZW5pbmcgY29tcG9uZW50XHJcbiAgICAgKlxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqL1xyXG4gICAgX29uQ2hhbmdlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy5fc2F2ZVNlbGVjdGlvbigpO1xyXG4gICAgICAgIHRoaXMubm90aWZ5Q2hhbmdlKCk7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxudmFyIGF2YWlsYWJsZVJlbmRlcmVycyA9IHtcclxuICAgICdib290c3RyYXAnOiBCb290c3RyYXBSZW5kZXJlcixcclxuICAgICdjaG9zZW4nOiBDaG9zZW5SZW5kZXJcclxufTtcclxuXHJcbnZhciBidWlsZGVyID0gZnVuY3Rpb24gKHNldHRpbmdzKSB7XHJcbiAgICB2YXIgcmVuZGVyZXIgPSBhdmFpbGFibGVSZW5kZXJlcnNbc2V0dGluZ3MucmVuZGVyZXJdIHx8IFNpbXBsZVJlbmRlcmVyO1xyXG5cclxuICAgIHJldHVybiAkLmV4dGVuZCh7fSwgdGhpcywgcmVuZGVyZXIsIHNldHRpbmdzKTtcclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgU2VsZWN0RmlsdGVyOiBTZWxlY3RGaWx0ZXIsXHJcbiAgICBidWlsZGVyOiBidWlsZGVyXHJcbn07XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJyQnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJyQnXSA6IG51bGwpO1xyXG52YXIgRmlsdGVycyA9IHJlcXVpcmUoJy4uL2ZpbHRlcnMnKTtcclxudmFyIEJhc2VTZWxlY3QgPSByZXF1aXJlKCcuL2Jhc2VzZWxlY3QnKTtcclxuXHJcbnZhciBGaXhlZFNlbGVjdEZpbHRlciA9ICQuZXh0ZW5kKHt9LCBCYXNlU2VsZWN0LlNlbGVjdEZpbHRlciwge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogU2ltcGx5IHNhdmVzIGEgaGFuZGxlIG9uIHRoZSBwcm92aWRlZCBzb3VyY2Ugc2VsZWN0XHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge0ZpeGVkU2VsZWN0RmlsdGVyfSBUaGUgc2VsZWN0IGZpbHRlclxyXG4gICAgICovXHJcbiAgICBpbml0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy4kZG9tID0gJCh0aGlzLnNyYyk7XHJcbiAgICAgICAgdGhpcy4kZG9tLm9uKCdjaGFuZ2UnLCB0aGlzLm5vdGlmeUNoYW5nZS5iaW5kKHRoaXMpKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogTm8gYWN0aW9uIGZvciBmaXhlZCBmaWx0ZXJzOiB0aGUgcHJvdmlkZWQgc2VsZWN0IGlzIHVzZWQgYXMgaXNcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7Rml4ZWRTZWxlY3RGaWx0ZXJ9IFRoZSBGaWx0ZXIgb2JqZWN0XHJcbiAgICAgKi9cclxuICAgIHBvcHVsYXRlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogTm8gdXBkYXRlIGZvciBmaXhlZCBmaWx0ZXJzOiB0aGUgcHJvdmlkZWQgc2VsZWN0IGlzIG5ldmVyIGNoYW5nZWRcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7Rml4ZWRTZWxlY3RGaWx0ZXJ9IFRoZSBGaWx0ZXIgb2JqZWN0XHJcbiAgICAgKi9cclxuICAgIHVwZGF0ZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEZpeGVkIGZpbHRlcnMgY2FuIGJlIHVzZWQgdG8gcHJvdmlkZSBpbml0aWFsIGZpbHRlcnMgdG8gYXBwbHkgdG8gdGhlXHJcbiAgICAgKiBkYXRhdGFibGUuXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge1N0cmluZ30gVGhlIEZpbHRlciBxdWVyeVxyXG4gICAgICovXHJcbiAgICBnZXRJbml0aWFsUXVlcnk6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLmdldFF1ZXJ5KCk7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxuRmlsdGVycy5wcm90b3R5cGUuYnVpbGRlcnMuZml4ZWRzZWxlY3QgPSBCYXNlU2VsZWN0LmJ1aWxkZXIuYmluZChGaXhlZFNlbGVjdEZpbHRlcik7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEZpeGVkU2VsZWN0RmlsdGVyO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgJCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WyckJ10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWyckJ10gOiBudWxsKTtcclxudmFyIEZpbHRlcnMgPSByZXF1aXJlKCcuLi9maWx0ZXJzJyk7XHJcbnZhciBCYXNlU2VsZWN0ID0gcmVxdWlyZSgnLi9iYXNlc2VsZWN0Jyk7XHJcblxyXG52YXIgTXVsdGlTZWxlY3RGaWx0ZXIgPSAkLmV4dGVuZCh7fSwgQmFzZVNlbGVjdC5TZWxlY3RGaWx0ZXIsIHtcclxuXHJcbiAgICAvKipcclxuICAgICAqIEluaXRpYWxpemVzIGEgbXVsdGlzZWxlY3QgZG9tIG9iamVjdFxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtNdWx0aVNlbGVjdEZpbHRlcn0gVGhlIEZpbHRlciBvYmplY3RcclxuICAgICAqL1xyXG4gICAgaW5pdDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMuJGRvbSA9ICQoJzxzZWxlY3QgY2xhc3M9XCJmaWx0cmVcIi8+JykuYXR0cignbXVsdGlwbGUnLCAnbXVsdGlwbGUnKTtcclxuICAgICAgICB0aGlzLiRkb20ub24oJ2NoYW5nZScsIHRoaXMuX29uQ2hhbmdlLmJpbmQodGhpcykpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBQb3B1bGF0ZXMgdGhlIG11bHRpc2VsZWN0IHdpdGggJ3NlbGVjdGVkJyBvcHRpb25zIGJ5IGRlZmF1bHRcclxuICAgICAqIFVzZXMgZ2V0SW5pdGlhbFF1ZXJ5IGFzIGRlZmF1bHQgdmFsdWUocylcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0ge0FycmF5PFN0cmluZz59IGRhdGEgVGhlIGNvbHVtbiBkYXRhXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge011bHRpU2VsZWN0RmlsdGVyfSBUaGUgRmlsdGVyIG9iamVjdFxyXG4gICAgICovXHJcbiAgICBwb3B1bGF0ZTogZnVuY3Rpb24gKGRhdGEpIHtcclxuICAgICAgICB0aGlzLl9hZGRPcHRpb25zKGRhdGEsIHRoaXMuX2FkZFNlbGVjdGVkT3B0aW9uKTtcclxuXHJcbiAgICAgICAgLy8gU2VsZWN0IGVhY2ggdmFsdWVzIHJldHVybmVkIGJ5IGdldEluaXRpYWxRdWVyeVxyXG4gICAgICAgIHZhciBpbml0aWFsUXVlcnkgPSB0aGlzLmdldEluaXRpYWxRdWVyeSgpO1xyXG5cclxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShpbml0aWFsUXVlcnkpKSB7XHJcbiAgICAgICAgICAgIGluaXRpYWxRdWVyeS5mb3JFYWNoKGZ1bmN0aW9uIChpbml0aWFsUXVlcnkpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuJGRvbS5maW5kKCdvcHRpb25bdmFsdWU9XCInICsgaW5pdGlhbFF1ZXJ5ICsgJ1wiXScpLmF0dHIoJ3NlbGVjdGVkJywgJ3NlbGVjdGVkJyk7XHJcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XHJcbiAgICAgICAgfSBlbHNlIHsgLy8gQXNzdW1lIGluaXRpYWwgcXVlcnkgaXMgYSBzdHJpbmdcclxuICAgICAgICAgICAgdGhpcy4kZG9tLmZpbmQoJ29wdGlvblt2YWx1ZT1cIicgKyBpbml0aWFsUXVlcnkgKyAnXCJdJykuYXR0cignc2VsZWN0ZWQnLCAnc2VsZWN0ZWQnKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuX3NhdmVTZWxlY3Rpb24oKTtcclxuICAgICAgICB0aGlzLl9vbkNoYW5nZSgpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBJZiB0aGUgJ2FsbCcgb3B0aW9uIGlzIHNlbGVjdGVkLCBzZXRzIHRoZSBuZXcgb3B0aW9ucyBhcyAnc2VsZWN0ZWQnLlxyXG4gICAgICogT3RoZXJ3aXNlLCBhZGRzIHRoZSBvcHRpb25zIGJhc2VkIG9uIHRoZSBmaWx0ZXIgc3RhdGVcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0ge0FycmF5PFN0cmluZz59IGRhdGEgVGhlIGNvbHVtbiBkYXRhXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge011bHRpU2VsZWN0RmlsdGVyfSBUaGUgRmlsdGVyIG9iamVjdFxyXG4gICAgICovXHJcbiAgICB1cGRhdGU6IGZ1bmN0aW9uIChkYXRhKSB7XHJcbiAgICAgICAgaWYgKCQuaW5BcnJheSh0aGlzLmFsbFRleHQsIHRoaXMuc2VsZWN0ZWQpID4gLTEgfHwgdGhpcy5fZ2V0Tm90U2VsZWN0ZWQoKS5sZW5ndGggPT0gMClcclxuICAgICAgICAgICAgdGhpcy5fYWRkT3B0aW9ucyhkYXRhLCB0aGlzLl9hZGRTZWxlY3RlZE9wdGlvbik7XHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICB0aGlzLl9hZGRPcHRpb25zKGRhdGEsIHRoaXMuX3JlZnJlc2hPcHRpb24pO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUaGlzIGZpbHRlciBpcyBkeW5hbWljLCBpdCBjYW4ndCBiZSB1c2VkIGZvciBpbml0aWFsIGZpbHRlcmluZ1xyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBmaWx0ZXIgaW5pdGlhbCBxdWVyeVxyXG4gICAgICovXHJcbiAgICBnZXRJbml0aWFsUXVlcnk6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gJyc7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVzZXQgdGhlIGZpbHRlciBieSBzZWxlY3QgYWxsIG9wdGlvbnMsXHJcbiAgICAgKiBzbyB0aGUgZmlsdGVyIHdpbGwga2VlcCBldmVyeSByb3dzXHJcbiAgICAgKiBAcmV0dXJucyB7TXVsdGlTZWxlY3RGaWx0ZXJ9IFRoZSBGaWx0ZXIgb2JqZWN0XHJcbiAgICAgKi9cclxuICAgIHJlc2V0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIGFsbFZhbHVlcyA9IHRoaXMuJGRvbS5maW5kKCdvcHRpb24nKS5nZXQoKS5tYXAoZnVuY3Rpb24gKG9wdGlvbikge1xyXG4gICAgICAgICAgICByZXR1cm4gb3B0aW9uLnZhbHVlO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHRoaXMuJGRvbS52YWwoYWxsVmFsdWVzKTtcclxuICAgICAgICB0aGlzLl9zYXZlU2VsZWN0aW9uKCk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbkZpbHRlcnMucHJvdG90eXBlLmJ1aWxkZXJzLm11bHRpc2VsZWN0ID0gQmFzZVNlbGVjdC5idWlsZGVyLmJpbmQoTXVsdGlTZWxlY3RGaWx0ZXIpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBNdWx0aVNlbGVjdEZpbHRlcjtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG52YXIgJCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WyckJ10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWyckJ10gOiBudWxsKTtcclxuXHJcbnZhciBCb290c3RyYXBSZW5kZXJlciA9IHtcclxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCRjb250YWluZXIsIGhlYWRlciwgZGF0YSkge1xyXG4gICAgICAgIHRoaXMucG9wdWxhdGUoZGF0YSk7XHJcbiAgICAgICAgdGhpcy5zaG93RmlsdGVyKHRoaXMuJGRvbSwgJGNvbnRhaW5lciwgaGVhZGVyLCBkYXRhKTtcclxuXHJcbiAgICAgICAgdmFyIGRlZmF1bHRPcHRpb25zID0ge1xyXG4gICAgICAgICAgICBidXR0b25UZXh0OiBmdW5jdGlvbiAob3B0aW9ucykge1xyXG4gICAgICAgICAgICAgICAgdmFyIG5iU2VsZWN0ZWQgPSAkKG9wdGlvbnMpLmZpbHRlcignOnNlbGVjdGVkJykubGVuZ3RoO1xyXG4gICAgICAgICAgICAgICAgaWYgKG5iU2VsZWN0ZWQgPT0gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBoZWFkZXI7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gaGVhZGVyICsgJyAoJyArIG5iU2VsZWN0ZWQgKyAnKSc7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB0aGlzLiRkb20ubXVsdGlzZWxlY3QoJC5leHRlbmQoZGVmYXVsdE9wdGlvbnMsIHRoaXMucmVuZGVyZXJPcHRpb25zKSk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICBzaG93RmlsdGVyOiBmdW5jdGlvbiAoJGRvbSwgJGNvbnRhaW5lcikge1xyXG4gICAgICAgICRjb250YWluZXIuYXBwZW5kKHRoaXMuJGRvbSk7XHJcbiAgICB9LFxyXG5cclxuICAgIHJlZnJlc2g6IGZ1bmN0aW9uIChkYXRhKSB7XHJcbiAgICAgICAgdGhpcy51cGRhdGUoZGF0YSk7XHJcbiAgICAgICAgdGhpcy4kZG9tLm11bHRpc2VsZWN0KCdyZWJ1aWxkJyk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBCb290c3RyYXBSZW5kZXJlcjsiLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgQ2hvc2VuUmVuZGVyZXIgPSB7XHJcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgkY29udGFpbmVyLCBoZWFkZXIsIGRhdGEpIHtcclxuICAgICAgICB0aGlzLnBvcHVsYXRlKGRhdGEpO1xyXG4gICAgICAgIHRoaXMuc2hvd0ZpbHRlcih0aGlzLiRkb20sICRjb250YWluZXIsIGhlYWRlciwgZGF0YSk7XHJcbiAgICAgICAgdGhpcy4kZG9tLmNob3Nlbih0aGlzLnJlbmRlcmVyT3B0aW9ucyB8fCB7fSk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICBzaG93RmlsdGVyOiBmdW5jdGlvbigkZG9tLCAkY29udGFpbmVyKSB7XHJcbiAgICAgICAgJGNvbnRhaW5lci5hcHBlbmQodGhpcy4kZG9tKTtcclxuICAgIH0sXHJcblxyXG4gICAgcmVmcmVzaDogZnVuY3Rpb24gKGRhdGEpIHtcclxuICAgICAgICB0aGlzLnVwZGF0ZShkYXRhKTtcclxuICAgICAgICB0aGlzLiRkb20udHJpZ2dlcignY2hvc2VuOnVwZGF0ZWQnKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IENob3NlblJlbmRlcmVyOyIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJyQnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJyQnXSA6IG51bGwpO1xyXG52YXIgRmlsdGVycyA9IHJlcXVpcmUoJy4uL2ZpbHRlcnMnKTtcclxudmFyIEJhc2VTZWxlY3QgPSByZXF1aXJlKCcuL2Jhc2VzZWxlY3QnKTtcclxuXHJcbnZhciBTaW1wbGVTZWxlY3RGaWx0ZXIgPSAkLmV4dGVuZCh7fSwgQmFzZVNlbGVjdC5TZWxlY3RGaWx0ZXIsIHtcclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYSBzaW1wbGUgc2VsZWN0XHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge1NpbXBsZVNlbGVjdEZpbHRlcn0gVGhlIEZpbHRlciBvYmplY3RcclxuICAgICAqL1xyXG4gICAgaW5pdDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMuJGRvbSA9ICQoJzxzZWxlY3QgY2xhc3M9XCJmaWx0cmVcIi8+Jyk7XHJcbiAgICAgICAgdGhpcy4kZG9tLm9uKCdjaGFuZ2UnLCB0aGlzLl9vbkNoYW5nZS5iaW5kKHRoaXMpKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQWRkcyBhbGwgb3B0aW9ucyB3aXRob3V0IHNwZWNpZnlpbmcgdGhlICdzZWxlY3RlZCcgZmxhZ1xyXG4gICAgICogSWYgYW4gb3B0aW9uIHdpdGggYGdldEluaXRpYWxRdWVyeWAgdmFsdWUgZXhpc3RzLCBzZWxlY3RzIGl0LFxyXG4gICAgICogb3RoZXJ3aXNlLCB0aGUgZmlyc3Qgb3B0aW9uIGlzIHNlbGVjdGVkIGJ5IGRlZmF1bHRcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0ge0FycmF5PFN0cmluZz59IGRhdGEgVGhlIGNvbHVtbiBkYXRhXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge1NpbXBsZVNlbGVjdEZpbHRlcn0gVGhlIGZpbHRlciBvYmplY3RcclxuICAgICAqL1xyXG4gICAgcG9wdWxhdGU6IGZ1bmN0aW9uIChkYXRhKSB7XHJcbiAgICAgICAgdGhpcy5fYWRkT3B0aW9ucyhkYXRhLCB0aGlzLl9yZWZyZXNoT3B0aW9uKTtcclxuICAgICAgICB0aGlzLiRkb20uZmluZCgnb3B0aW9uW3ZhbHVlPVwiJyArIHRoaXMuZ2V0SW5pdGlhbFF1ZXJ5KCkgKyAnXCJdJykuYXR0cignc2VsZWN0ZWQnLCAnc2VsZWN0ZWQnKTtcclxuICAgICAgICB0aGlzLl9zYXZlU2VsZWN0aW9uKCk7XHJcbiAgICAgICAgdGhpcy5fb25DaGFuZ2UoKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVmcmVzaCB0aGUgb3B0aW9ucyBiYXNlZCBvbiB0aGUgZmlsdGVyIHN0YXRlXHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtIHtBcnJheTxTdHJpbmc+fSBkYXRhIFRoZSBjb2x1bW4gZGF0YVxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtTaW1wbGVTZWxlY3RGaWx0ZXJ9IFRoZSBmaWx0ZXIgb2JqZWN0XHJcbiAgICAgKi9cclxuICAgIHVwZGF0ZTogZnVuY3Rpb24gKGRhdGEpIHtcclxuICAgICAgICB0aGlzLl9hZGRPcHRpb25zKGRhdGEsIHRoaXMuX3JlZnJlc2hPcHRpb24pO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUaGlzIGZpbHRlciBpcyBkeW5hbWljLCBpdCBjYW4ndCBiZSB1c2VkIGZvciBpbml0aWFsIGZpbHRlcmluZ1xyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBmaWx0ZXIncyBpbml0aWFsIHF1ZXJ5XHJcbiAgICAgKi9cclxuICAgIGdldEluaXRpYWxRdWVyeTogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgcmV0dXJuICcnO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbkZpbHRlcnMucHJvdG90eXBlLmJ1aWxkZXJzLnNlbGVjdCA9IEJhc2VTZWxlY3QuYnVpbGRlci5iaW5kKFNpbXBsZVNlbGVjdEZpbHRlcik7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFNpbXBsZVNlbGVjdEZpbHRlcjtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIEZpbHRlcnMgPSByZXF1aXJlKCcuLi9maWx0ZXJzJyk7XHJcblxyXG4vKipcclxuICogRHVtbXkgdXBkYXRlclxyXG4gKi9cclxudmFyIFVwZGF0ZU5vbmUgPSB7XHJcbiAgICByZWZyZXNoQWxsRmlsdGVyczogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG59O1xyXG5cclxuRmlsdGVycy5wcm90b3R5cGUudXBkYXRlcnMubm9uZSA9IFVwZGF0ZU5vbmU7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBGaWx0ZXJzID0gcmVxdWlyZSgnLi4vZmlsdGVycycpO1xyXG5cclxuLyoqXHJcbiAqIEVhY2ggdGltZSBhIGZpbHRlciBjaGFuZ2VkLFxyXG4gKiByZWZyZXNoIHRoZSBvdGhlcnMgZmlsdGVycy5cclxuICovXHJcbnZhciBVcGRhdGVPdGhlcnMgPSB7XHJcblxyXG4gICAgcmVmcmVzaEFsbEZpbHRlcnM6IGZ1bmN0aW9uIChmaWx0ZXIpIHtcclxuICAgICAgICAvLyByZWZyZXNoIGFsbCBmaWx0ZXJzXHJcbiAgICAgICAgLy8gZXhjZXB0IHRoZSBjaGFuZ2VkIG9uZSxcclxuICAgICAgICAvLyB1bmxlc3MgdGhlIGZpbHRlciBpcyByZXNldHRlZC5cclxuICAgICAgICB2YXIgZmlsdGVyc1RvUmVmcmVzaCA9IHRoaXMuZmlsdGVyc1xyXG4gICAgICAgICAgICAuZmlsdGVyKGZ1bmN0aW9uIChmKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZi5jb2x1bW4gIT09IGZpbHRlci5jb2x1bW47XHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuXHJcbiAgICAgICAgZmlsdGVyc1RvUmVmcmVzaC5mb3JFYWNoKGZ1bmN0aW9uIChmaWx0ZXIpIHtcclxuICAgICAgICAgICAgZmlsdGVyLnJlZnJlc2godGhpcy5nZXRGaWx0ZXJlZENvbHVtbkRhdGEoZmlsdGVyLmNvbHVtbikpO1xyXG4gICAgICAgIH0sIHRoaXMpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxufTtcclxuXHJcbkZpbHRlcnMucHJvdG90eXBlLnVwZGF0ZXJzLm90aGVycyA9IFVwZGF0ZU90aGVycztcclxuIl19
