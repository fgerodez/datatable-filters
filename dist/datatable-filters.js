(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
'use strict';

var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null);

/**
 * BaseFilter
 */
var BaseFilter = {

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
        if (!this.hasValue())
            return this.noSelectionQuery();

        return this.selectedQuery();
    },

    register: function(callback) {
        this.$dom.on('update.filters.dt', callback);
    }
};

module.exports = BaseFilter;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],2:[function(require,module,exports){
(function (global){
'use strict';

var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null);

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
    var renderCol = 0;
    $.each(settings.aoColumns, function (col, param) {
        if (param.filter) {
            var options = $.extend({
              column: col,
              renderColumn: renderCol
            }, param.filter);
            filters.push(builders[param.filter.type](options));
        }
        if(param.bVisible) {
          renderCol++;
        }
    });

    if (filters.length > 0) {
        this.filters = filters;
        this.filters.forEach(function (filter) {
            filter.init();
        });
        this.filters.forEach(this.applyInitialFilter, this);
        this.tableAPI.on('init', this.onDataTableInit.bind(this));
    }
};

$.extend(Filters.prototype, {

    /**
     * Array of filter constructor function. Each function
     * takes a setting object as its single parameter
     */
    builders: {},

    /**
     * Table header dom node
     * @type {jQuery}
     */
    $header: null,

    /**
     * Filters array
     * @type {Array}
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
     * @return {jQuery} The unfiltered column rendered data
     */
    getColumnData: function (col) {
        return this.tableAPI.cells(null, col).render('display').unique();
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
     * Enables filters to apply an initial column filter, before
     * any data processing/displaying is done.
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
        var $container = this.$header.find('.fond-header:eq(' + filter.renderColumn + ')');

        if (filter.isServerSide()) {
            filter.register($.proxy(this.onServerFilterChange, this));
        } else {
            filter.register($.proxy(this.onClientFilterChange, this));
        }

        filter.render($container, $colHeader.html(), this.getColumnData(col));
        if(filter.className) {
          filter.$dom.addClass(filter.className);
        }
        if(filter.attrs) {
          filter.$dom.attr(filter.attrs);
        }
    },

    /**
     * Refreshes the filters based on the currently displayed data for each column
     *
     * @return {Filters}
     */
    refreshFilters: function () {
        this.filters.forEach(function (filter) {
            filter.refresh(this.getColumnData(filter.column));
            this.applyFilter(filter);
        }, this);

        this.drawTable();

        return this;
    }
});

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
    }
});

Filters.prototype.builders.input = function(settings) {
  return $.extend({}, InputFilter, settings);
};

module.exports = InputFilter;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../basefilter":1,"../filters":2,"../renderer/simple":5}],4:[function(require,module,exports){
'use strict';

require('./select/simpleselect');
require('./select/multiselect');
require('./select/fixedselect');
require('./input/input');
require('./filters');
},{"./filters":2,"./input/input":3,"./select/fixedselect":7,"./select/multiselect":8,"./select/simpleselect":11}],5:[function(require,module,exports){
(function (global){
'use strict';

var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null);

var SimpleRenderer = {
    render: function ($container, header, data) {
        this.populate(data);
        this.showFilter(this.$dom, $container, header, data);

        return this;
    },

    showFilter: function($dom, $container, header, data) {
        $container.append(this.$dom);
        this.$dom.attr('name', header).attr('placeholder', header).show();
    },

    refresh: function (data) {
        this.update(data);

        return this;
    }
};

module.exports = SimpleRenderer;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

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
            if (value == this.allText  || this._getNotSelected().length === 0) {
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
     * @param value {String} Option value
     */
    filterOptions: function (value) {
        return value.trim() != '';
    },

    /**
     * Sort the options before adding them to the select. Can be overridden for
     * specific sorts
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
        return this.$dom.find('option:selected').toArray().map(function(option) {
            return option.value;
        });
    },

    /**
     *
     * @returns {*|Array} The array of non selected values
     * @private
     */
    _getNotSelected: function() {
        return this.$dom.find(':not(option:selected)').toArray().map(function(option) {
            return option.value;
        });
    },

    /**
     * For each element in the data object, creates an option element using the function
     * fnCreate
     *
     * @param data {jQuery} The data to add to the select
     * @param fnCreate {Function} The function to use to create the options
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
     * @param value {String} The option value
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
     * @param value {String} The option value
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
    _saveSelection: function() {
        this.selected = this._getSelection();
    },

    /**
     * Whenever the select state changes, save its new state and
     * notify the listening component
     *
     * @private
     */
    _onChange: function() {
        this._saveSelection();
        this.notifyChange();
    }
});

 var availableRenderers = {
    'bootstrap': BootstrapRenderer,
    'chosen': ChosenRender
};

var builder = function(settings) {
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
     * @returns {MultiSelectFilter}
     */
    init: function () {
        this.$dom = $('<select class="filtre"/>').attr('multiple', 'multiple');
        this.$dom.on('change', this._onChange.bind(this));

        return this;
    },

    /**
     * Populates the multiselect with 'selected' options by default
     *
     * @param data
     * @returns {MultiSelectFilter}
     */
    populate: function (data) {
        this._addOptions(data, this._addSelectedOption);
        this._onChange();

        return this;
    },

    /**
     * If the 'all' option is selected, sets the new options as 'selected'.
     * Otherwise, adds the options based on the filter state
     *
     * @param data
     * @returns {MultiSelectFilter}
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
     * @returns {string}
     */
    getInitialQuery: function() {
        return '';
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
                if(nbSelected == 0) {
                    return header;
                }
                return header + ' (' + nbSelected + ')';
            }
        };

        this.$dom.multiselect($.extend(defaultOptions, this.rendererOptions));

        return this;
    },

    selectedQuery: function () {
        var $widget = this.$dom.multiselect();

        if ($.inArray($widget.selectAllText, $widget.val())) {
            return '';
        } else {
            return this._getSelection().map(function (value) {
                if (value == this.allText) {
                    return '';
                } else {
                    return '^' + $.fn.dataTable.util.escapeRegex(value) + '$';
                }
            }, this).join('|');
        }
    },

    showFilter: function($dom, $container, header, data) {
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
(function (global){
'use strict';
var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null);

var ChosenRenderer = {
    render: function ($container, header, data) {
        this.populate(data);
        this.showFilter(this.$dom, $container, header, data);
        this.$dom.chosen(this.rendererOptions || {});

        return this;
    },

    showFilter: function($dom, $container, header, data) {
        $container.append(this.$dom);
    },

    refresh: function (data) {
        this.update(data);
        this.$dom.trigger('chosen:updated');

        return this;
    }
};

module.exports = ChosenRenderer;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

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
     * @returns {SimpleSelectFilter}
     */
    init: function () {
        this.$dom = $('<select class="filtre"/>');
        this.$dom.on('change', this._onChange.bind(this));

        return this;
    },

    /**
     * Adds all options without specifying the 'selected' flag
     * (the first option is selected by default)
     *
     * @param data
     * @returns {SimpleSelectFilter}
     */
    populate: function (data) {
        this._addOptions(data, this._refreshOption);
        this._onChange();

        return this;
    },

    /**
     * Refresh the options based on the filter state
     *
     * @param data
     * @returns {SimpleSelectFilter}
     */
    update: function (data) {
        this._addOptions(data, this._refreshOption);

        return this;
    },

    /**
     * This filter is dynamic, it can't be used for initial filtering
     *
     * @returns {string}
     */
    getInitialQuery: function() {
        return '';
    }
});

Filters.prototype.builders.select = BaseSelect.builder.bind(SimpleSelectFilter);

module.exports = SimpleSelectFilter;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../filters":2,"./baseselect":6}]},{},[4])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJqcy9iYXNlZmlsdGVyLmpzIiwianMvZmlsdGVycy5qcyIsImpzL2lucHV0L2lucHV0LmpzIiwianMvbWFpbi5qcyIsImpzL3JlbmRlcmVyL3NpbXBsZS5qcyIsImpzL3NlbGVjdC9iYXNlc2VsZWN0LmpzIiwianMvc2VsZWN0L2ZpeGVkc2VsZWN0LmpzIiwianMvc2VsZWN0L211bHRpc2VsZWN0LmpzIiwianMvc2VsZWN0L3JlbmRlcmVyL2Jvb3RzdHJhcC5qcyIsImpzL3NlbGVjdC9yZW5kZXJlci9jaG9zZW4uanMiLCJqcy9zZWxlY3Qvc2ltcGxlc2VsZWN0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ2hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNqUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDeEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDckxBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ25EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQzdEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNuREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDeEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snJCddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnJCddIDogbnVsbCk7XHJcblxyXG4vKipcclxuICogQmFzZUZpbHRlclxyXG4gKi9cclxudmFyIEJhc2VGaWx0ZXIgPSB7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gV2hldGhlciBhIGZpbHRlciBjaGFuZ2UgbXVzdCB0cmlnZ2VyIGEgZGF0YXRhYmxlIHJlbG9hZC5cclxuICAgICAqIERlZmF1bHQgaXMgZmFsc2UgKGNsaWVudCBzaWRlIGZpbHRlcikuXHJcbiAgICAgKi9cclxuICAgIGlzU2VydmVyU2lkZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgcmVxdWVzdCBwYXJhbWV0ZXIgYXNzb2NpYXRlZCB3aXRoIHRoaXMgZmlsdGVyIChpbiB0aGUgZm9ybSBrZXk9cGFyYW0sXHJcbiAgICAgKiBvbmx5IHVzZWQgZm9yIHNlcnZlciBzaWRlIGZpbHRlcnMpXHJcbiAgICAgKi9cclxuICAgIGdldFNlcnZlclF1ZXJ5OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuICcnO1xyXG4gICAgfSxcclxuXHJcbiAgICBub3RpZnlDaGFuZ2U6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLiRkb20udHJpZ2dlcigndXBkYXRlLmZpbHRlcnMuZHQnLCB7XHJcbiAgICAgICAgICAgIGZpbHRlcjogdGhpc1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgZmlsdGVyIHN0cmluZyB0byBiZSBhcHBsaWVkIHRvIHRoZSBkYXRhdGFibGUgY29sdW1uXHJcbiAgICAgKi9cclxuICAgIGdldFF1ZXJ5OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLmhhc1ZhbHVlKCkpXHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm5vU2VsZWN0aW9uUXVlcnkoKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXMuc2VsZWN0ZWRRdWVyeSgpO1xyXG4gICAgfSxcclxuXHJcbiAgICByZWdpc3RlcjogZnVuY3Rpb24oY2FsbGJhY2spIHtcclxuICAgICAgICB0aGlzLiRkb20ub24oJ3VwZGF0ZS5maWx0ZXJzLmR0JywgY2FsbGJhY2spO1xyXG4gICAgfVxyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBCYXNlRmlsdGVyOyIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJyQnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJyQnXSA6IG51bGwpO1xyXG5cclxuLyoqXHJcbiAqIEZpbHRlcnMgaXMgYSBjb21wb25lbnQgdGhhdCBtYW5hZ2VzIGEgbGlzdCBvZiBmaWx0ZXJzIG9iamVjdCBpbnNpZGVcclxuICogYSBkYXRhdGFibGUgaGVhZGVyIHJvdy5cclxuICpcclxuICogVGhpcyBjb25zdHJ1Y3RvciBiaW5kcyBsaXN0ZW5lcnMgdG8gdmFyaW91cyBkYXRhdGFibGUgZXZlbnRzLlxyXG4gKlxyXG4gKiBAcGFyYW0gc2V0dGluZ3Mge09iamVjdH0gc2V0dGluZ3Mgb2JqZWN0IHVzZWQgdG8gY3JlYXRlIHRoZSBkYXRhdGFibGVcclxuICovXHJcbnZhciBGaWx0ZXJzID0gZnVuY3Rpb24gKHNldHRpbmdzKSB7XHJcbiAgICB0aGlzLnRhYmxlQVBJID0gbmV3ICQuZm4uZGF0YVRhYmxlLkFwaShzZXR0aW5ncyk7XHJcbiAgICB0aGlzLiRoZWFkZXIgPSAkKHRoaXMudGFibGVBUEkudGFibGUoKS5oZWFkZXIoKSk7XHJcbiAgICB0aGlzLnVybCA9IHRoaXMudGFibGVBUEkuYWpheC51cmwoKTtcclxuXHJcbiAgICB2YXIgZmlsdGVycyA9IFtdO1xyXG4gICAgdmFyIGJ1aWxkZXJzID0gdGhpcy5idWlsZGVycztcclxuICAgIHZhciByZW5kZXJDb2wgPSAwO1xyXG4gICAgJC5lYWNoKHNldHRpbmdzLmFvQ29sdW1ucywgZnVuY3Rpb24gKGNvbCwgcGFyYW0pIHtcclxuICAgICAgICBpZiAocGFyYW0uZmlsdGVyKSB7XHJcbiAgICAgICAgICAgIHZhciBvcHRpb25zID0gJC5leHRlbmQoe1xyXG4gICAgICAgICAgICAgIGNvbHVtbjogY29sLFxyXG4gICAgICAgICAgICAgIHJlbmRlckNvbHVtbjogcmVuZGVyQ29sXHJcbiAgICAgICAgICAgIH0sIHBhcmFtLmZpbHRlcik7XHJcbiAgICAgICAgICAgIGZpbHRlcnMucHVzaChidWlsZGVyc1twYXJhbS5maWx0ZXIudHlwZV0ob3B0aW9ucykpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZihwYXJhbS5iVmlzaWJsZSkge1xyXG4gICAgICAgICAgcmVuZGVyQ29sKys7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgaWYgKGZpbHRlcnMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIHRoaXMuZmlsdGVycyA9IGZpbHRlcnM7XHJcbiAgICAgICAgdGhpcy5maWx0ZXJzLmZvckVhY2goZnVuY3Rpb24gKGZpbHRlcikge1xyXG4gICAgICAgICAgICBmaWx0ZXIuaW5pdCgpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHRoaXMuZmlsdGVycy5mb3JFYWNoKHRoaXMuYXBwbHlJbml0aWFsRmlsdGVyLCB0aGlzKTtcclxuICAgICAgICB0aGlzLnRhYmxlQVBJLm9uKCdpbml0JywgdGhpcy5vbkRhdGFUYWJsZUluaXQuYmluZCh0aGlzKSk7XHJcbiAgICB9XHJcbn07XHJcblxyXG4kLmV4dGVuZChGaWx0ZXJzLnByb3RvdHlwZSwge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQXJyYXkgb2YgZmlsdGVyIGNvbnN0cnVjdG9yIGZ1bmN0aW9uLiBFYWNoIGZ1bmN0aW9uXHJcbiAgICAgKiB0YWtlcyBhIHNldHRpbmcgb2JqZWN0IGFzIGl0cyBzaW5nbGUgcGFyYW1ldGVyXHJcbiAgICAgKi9cclxuICAgIGJ1aWxkZXJzOiB7fSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIFRhYmxlIGhlYWRlciBkb20gbm9kZVxyXG4gICAgICogQHR5cGUge2pRdWVyeX1cclxuICAgICAqL1xyXG4gICAgJGhlYWRlcjogbnVsbCxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEZpbHRlcnMgYXJyYXlcclxuICAgICAqIEB0eXBlIHtBcnJheX1cclxuICAgICAqL1xyXG4gICAgZmlsdGVyczogW10sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUYWJsZSBpbml0aWFsIGFqYXggVVJMXHJcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxyXG4gICAgICovXHJcbiAgICB1cmw6ICcnLFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVmcmVzaGVzIGZpbHRlcnMgYWZ0ZXIgZWFjaCBhamF4IHJlcXVlc3RcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7RmlsdGVyc31cclxuICAgICAqL1xyXG4gICAgcmVnaXN0ZXJBamF4TGlzdGVuZXI6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLnRhYmxlQVBJLm9uKCd4aHInLCAkLnByb3h5KGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdGhpcy50YWJsZUFQSS5vbmUoJ3ByZURyYXcnLCAkLnByb3h5KHRoaXMucmVmcmVzaEZpbHRlcnMsIHRoaXMpKTtcclxuICAgICAgICB9LCB0aGlzKSk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEluaXRpYWxpemVzIHRoZSBoZWFkZXIgSFRNTCBlbGVtZW50cyB0aGF0IHdpbGwgYmUgdXNlZCB0byBob2xkIHRoZSBmaWx0ZXJzLlxyXG4gICAgICogSXQgYWxzbyByZWdpc3RlcnMgdGhlIG1haW4gZXZlbnQgaGFuZGxlciB0aGF0IHdpbGwgcmVhY3QgdG8gdGhlIGZpbHRlcnMnXHJcbiAgICAgKiB2YWx1ZSBjaGFuZ2VzLlxyXG4gICAgICpcclxuICAgICAqIFRoZSBldmVudCBuYW1lIGlzIDxiPmZpbHRlckNoYW5nZTwvYj4uIFRoaXMgZXZlbnQgbXVzdCBiZSB0cmlnZ2VyZWQgYnkgdGhlXHJcbiAgICAgKiBmaWx0ZXJzIHdoZW4gdGhlaXIgdmFsdWUgaXMgbW9kaWZpZWQgYnkgdGhlIHVzZXIgKG9yIGFueSBvdGhlciBldmVudCB0aGF0XHJcbiAgICAgKiBzaG91bGQgdHJpZ2dlciBhIGRhdGF0YWJsZSBmaWx0ZXIpLlxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJzfVxyXG4gICAgICovXHJcbiAgICBzZXR1cEhlYWRlclJvdzogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciAkZmlsdGVySGVhZGVyID0gJCgnPHRyIGNsYXNzPVwiZmlsdGVyc1wiPjwvdHI+Jyk7XHJcblxyXG4gICAgICAgIHRoaXMudGFibGVBUEkuY29sdW1ucygnOnZpc2libGUnKS5oZWFkZXIoKS5lYWNoKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgJGZpbHRlckhlYWRlci5hcHBlbmQoJzx0aCBjbGFzcz1cImZvbmQtaGVhZGVyXCI+PC90aD4nKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy4kaGVhZGVyLmFwcGVuZCgkZmlsdGVySGVhZGVyKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVkcmF3cyB0aGUgZGF0YXRhYmxlXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge0ZpbHRlcnN9XHJcbiAgICAgKi9cclxuICAgIGRyYXdUYWJsZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMudGFibGVBUEkuZHJhdygpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXRyaWV2ZXMgdGhlIGNvbHVtbiBkYXRhIChjdXJyZW50IGZpbHRlciBpcyBpZ25vcmVkKVxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSBjb2wge2ludH0gVGhlIGNvbHVtbiBpbmRleCAoMCBiYXNlZClcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJuIHtqUXVlcnl9IFRoZSB1bmZpbHRlcmVkIGNvbHVtbiByZW5kZXJlZCBkYXRhXHJcbiAgICAgKi9cclxuICAgIGdldENvbHVtbkRhdGE6IGZ1bmN0aW9uIChjb2wpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy50YWJsZUFQSS5jZWxscyhudWxsLCBjb2wpLnJlbmRlcignZGlzcGxheScpLnVuaXF1ZSgpO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIFJldHJpZXZlcyB0aGUgY29sdW1uIGZpbHRlcmVkIGRhdGFcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0gY29sIHtpbnR9IFRoZSBjb2x1bW4gaW5kZXggKDAgYmFzZWQpXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybiB7alF1ZXJ5fSBUaGUgZmlsdGVyZWQgY29sdW1uIGRhdGFcclxuICAgICAqL1xyXG4gICAgZ2V0RmlsdGVyZWRDb2x1bW5EYXRhOiBmdW5jdGlvbiAoY29sKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMudGFibGVBUEkuY29sdW1uKGNvbCwge3NlYXJjaDogJ2FwcGxpZWQnfSkuZGF0YSgpLnVuaXF1ZSgpO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEFjdGlvbnMgdG8gZXhlY3V0ZSB3aGVuIHRoZSBkYXRhdGFibGUgaXMgZG9uZSBpbml0aWFsaXppbmcuXHJcbiAgICAgKiBDcmVhdGVzIHRoZSBmaWx0ZXIgaGVhZGVyIHJvdywgcmVnaXN0ZXJzIGFqYXggbGlzdGVuZXJzIGFuZFxyXG4gICAgICogcmVuZGVycyBmaWx0ZXJzXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge0ZpbHRlcnN9XHJcbiAgICAgKi9cclxuICAgIG9uRGF0YVRhYmxlSW5pdDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMuc2V0dXBIZWFkZXJSb3coKS5yZWdpc3RlckFqYXhMaXN0ZW5lcigpLnJlbmRlckZpbHRlcnMoKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogV2hlbiBhIGNsaWVudC1zaWRlIGZpbHRlciBjaGFuZ2VzLCBhcHBsaWVzIGl0cyBuZXcgdmFsdWVcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0gZXZlbnQge0V2ZW50fSBldmVudCBvYmplY3RcclxuICAgICAqIEBwYXJhbSBwYXJhbXMge09iamVjdH0gZXZlbnQgcGFyYW1zXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybiB7RmlsdGVyc31cclxuICAgICAqL1xyXG4gICAgb25DbGllbnRGaWx0ZXJDaGFuZ2U6IGZ1bmN0aW9uIChldmVudCwgcGFyYW1zKSB7XHJcbiAgICAgICAgdGhpcy5hcHBseUZpbHRlcihwYXJhbXMuZmlsdGVyKS5kcmF3VGFibGUoKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogV2hlbiBhIHNlcnZlci1zaWRlIGZpbHRlciBjaGFuZ2VzLCBidWlsZHMgdGhlIG5ldyBhamF4IHF1ZXJ5IGFuZCByZWZyZXNoZXMgdGhlIHRhYmxlXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybiB7RmlsdGVyc31cclxuICAgICAqL1xyXG4gICAgb25TZXJ2ZXJGaWx0ZXJDaGFuZ2U6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgc2VydmVyUXVlcnkgPSAkLmdyZXAodGhpcy5maWx0ZXJzLCBmdW5jdGlvbiAoZmlsdGVyKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmaWx0ZXIuaXNTZXJ2ZXJTaWRlKCk7XHJcbiAgICAgICAgfSkubWFwKGZ1bmN0aW9uIChmaWx0ZXIpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGZpbHRlci5nZXRTZXJ2ZXJRdWVyeSgpO1xyXG4gICAgICAgIH0pLmpvaW4oJyYnKTtcclxuXHJcbiAgICAgICAgdGhpcy50YWJsZUFQSS5hamF4LnVybCh0aGlzLnVybCArICc/JyArIHNlcnZlclF1ZXJ5KS5hamF4LnJlbG9hZCgpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBBcHBsaWVzIHRoZSBmaWx0ZXIgdmFsdWUgdG8gdGhlIHJlbGF0ZWQgY29sdW1uXHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtIGZpbHRlciBUaGUgZmlsdGVyIG9iamVjdFxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm4ge0ZpbHRlcnN9XHJcbiAgICAgKi9cclxuICAgIGFwcGx5RmlsdGVyOiBmdW5jdGlvbiAoZmlsdGVyKSB7XHJcbiAgICAgICAgdGhpcy50YWJsZUFQSS5jb2x1bW4oZmlsdGVyLmNvbHVtbikuc2VhcmNoKFxyXG4gICAgICAgICAgICBmaWx0ZXIuZ2V0UXVlcnkoKSxcclxuICAgICAgICAgICAgZmlsdGVyLmlzUmVnZXhNYXRjaCgpXHJcbiAgICAgICAgICAgICwgZmFsc2UpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBFbmFibGVzIGZpbHRlcnMgdG8gYXBwbHkgYW4gaW5pdGlhbCBjb2x1bW4gZmlsdGVyLCBiZWZvcmVcclxuICAgICAqIGFueSBkYXRhIHByb2Nlc3NpbmcvZGlzcGxheWluZyBpcyBkb25lLlxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSBmaWx0ZXJcclxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJzfVxyXG4gICAgICovXHJcbiAgICBhcHBseUluaXRpYWxGaWx0ZXI6IGZ1bmN0aW9uIChmaWx0ZXIpIHtcclxuICAgICAgICB0aGlzLnRhYmxlQVBJLmNvbHVtbihmaWx0ZXIuY29sdW1uKS5zZWFyY2goXHJcbiAgICAgICAgICAgIGZpbHRlci5nZXRJbml0aWFsUXVlcnkoKSxcclxuICAgICAgICAgICAgZmlsdGVyLmlzUmVnZXhNYXRjaCgpXHJcbiAgICAgICAgICAgICwgZmFsc2UpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAc2VlIHRoaXMucmVuZGVyRmlsdGVyXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge0ZpbHRlcnN9XHJcbiAgICAgKi9cclxuICAgIHJlbmRlckZpbHRlcnM6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLmZpbHRlcnMuZm9yRWFjaCh0aGlzLnJlbmRlckZpbHRlciwgdGhpcyk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEFza3MgYSBmaWx0ZXIgdG8gcmVuZGVyIGl0c2VsZiBhbmQgcHJvdmlkZXMgYW4gb3B0aW9uYWwgY29udGFpbmVyXHJcbiAgICAgKiBmb3IgZmlsdGVycyB0aGF0IG5lZWQgdG8gYmUgcmVuZGVyZWQgaW5zaWRlIHRoZSBkYXRhdGFibGUgaGVhZGVyIHJvd1xyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSBmaWx0ZXIgVGhlIGZpbHRlciBvYmplY3RcclxuICAgICAqL1xyXG4gICAgcmVuZGVyRmlsdGVyOiBmdW5jdGlvbiAoZmlsdGVyKSB7XHJcbiAgICAgICAgdmFyIGNvbCA9IGZpbHRlci5jb2x1bW47XHJcbiAgICAgICAgdmFyICRjb2xIZWFkZXIgPSAkKHRoaXMudGFibGVBUEkuY29sdW1uKGNvbCkuaGVhZGVyKCkpO1xyXG4gICAgICAgIHZhciAkY29udGFpbmVyID0gdGhpcy4kaGVhZGVyLmZpbmQoJy5mb25kLWhlYWRlcjplcSgnICsgZmlsdGVyLnJlbmRlckNvbHVtbiArICcpJyk7XHJcblxyXG4gICAgICAgIGlmIChmaWx0ZXIuaXNTZXJ2ZXJTaWRlKCkpIHtcclxuICAgICAgICAgICAgZmlsdGVyLnJlZ2lzdGVyKCQucHJveHkodGhpcy5vblNlcnZlckZpbHRlckNoYW5nZSwgdGhpcykpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGZpbHRlci5yZWdpc3RlcigkLnByb3h5KHRoaXMub25DbGllbnRGaWx0ZXJDaGFuZ2UsIHRoaXMpKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZpbHRlci5yZW5kZXIoJGNvbnRhaW5lciwgJGNvbEhlYWRlci5odG1sKCksIHRoaXMuZ2V0Q29sdW1uRGF0YShjb2wpKTtcclxuICAgICAgICBpZihmaWx0ZXIuY2xhc3NOYW1lKSB7XHJcbiAgICAgICAgICBmaWx0ZXIuJGRvbS5hZGRDbGFzcyhmaWx0ZXIuY2xhc3NOYW1lKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYoZmlsdGVyLmF0dHJzKSB7XHJcbiAgICAgICAgICBmaWx0ZXIuJGRvbS5hdHRyKGZpbHRlci5hdHRycyk7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIFJlZnJlc2hlcyB0aGUgZmlsdGVycyBiYXNlZCBvbiB0aGUgY3VycmVudGx5IGRpc3BsYXllZCBkYXRhIGZvciBlYWNoIGNvbHVtblxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm4ge0ZpbHRlcnN9XHJcbiAgICAgKi9cclxuICAgIHJlZnJlc2hGaWx0ZXJzOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy5maWx0ZXJzLmZvckVhY2goZnVuY3Rpb24gKGZpbHRlcikge1xyXG4gICAgICAgICAgICBmaWx0ZXIucmVmcmVzaCh0aGlzLmdldENvbHVtbkRhdGEoZmlsdGVyLmNvbHVtbikpO1xyXG4gICAgICAgICAgICB0aGlzLmFwcGx5RmlsdGVyKGZpbHRlcik7XHJcbiAgICAgICAgfSwgdGhpcyk7XHJcblxyXG4gICAgICAgIHRoaXMuZHJhd1RhYmxlKCk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbiQoZG9jdW1lbnQpLm9uKCdwcmVJbml0LmR0JywgZnVuY3Rpb24gKGUsIHNldHRpbmdzKSB7XHJcbiAgICBuZXcgRmlsdGVycyhzZXR0aW5ncyk7XHJcbn0pO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBGaWx0ZXJzO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgJCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WyckJ10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWyckJ10gOiBudWxsKTtcclxudmFyIEJhc2VGaWx0ZXIgPSByZXF1aXJlKCcuLi9iYXNlZmlsdGVyJyk7XHJcbnZhciBTaW1wbGVSZW5kZXJlciA9IHJlcXVpcmUoJy4uL3JlbmRlcmVyL3NpbXBsZScpO1xyXG52YXIgRmlsdGVycyA9IHJlcXVpcmUoJy4uL2ZpbHRlcnMnKTtcclxuXHJcbnZhciBJbnB1dEZpbHRlciA9ICQuZXh0ZW5kKHt9LCBCYXNlRmlsdGVyLCBTaW1wbGVSZW5kZXJlciwge1xyXG5cclxuICAgIGluaXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLiRkb20gPSAkKCc8aW5wdXQgY2xhc3M9XCJmaWx0cmVcIi8+Jyk7XHJcbiAgICAgICAgdGhpcy4kZG9tLm9uKCdpbnB1dCcsIHRoaXMubm90aWZ5Q2hhbmdlLmJpbmQodGhpcykpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgcG9wdWxhdGU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgdXBkYXRlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIG5vU2VsZWN0aW9uUXVlcnk6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gJyc7XHJcbiAgICB9LFxyXG5cclxuICAgIGlzUmVnZXhNYXRjaDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfSxcclxuXHJcbiAgICBoYXNWYWx1ZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLiRkb20udmFsKCkgIT0gJyc7XHJcbiAgICB9LFxyXG5cclxuICAgIHNlbGVjdGVkUXVlcnk6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy4kZG9tLnZhbCgpO1xyXG4gICAgfSxcclxuXHJcbiAgICBnZXRJbml0aWFsUXVlcnk6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gJyc7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxuRmlsdGVycy5wcm90b3R5cGUuYnVpbGRlcnMuaW5wdXQgPSBmdW5jdGlvbihzZXR0aW5ncykge1xyXG4gIHJldHVybiAkLmV4dGVuZCh7fSwgSW5wdXRGaWx0ZXIsIHNldHRpbmdzKTtcclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gSW5wdXRGaWx0ZXI7IiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxucmVxdWlyZSgnLi9zZWxlY3Qvc2ltcGxlc2VsZWN0Jyk7XHJcbnJlcXVpcmUoJy4vc2VsZWN0L211bHRpc2VsZWN0Jyk7XHJcbnJlcXVpcmUoJy4vc2VsZWN0L2ZpeGVkc2VsZWN0Jyk7XHJcbnJlcXVpcmUoJy4vaW5wdXQvaW5wdXQnKTtcclxucmVxdWlyZSgnLi9maWx0ZXJzJyk7IiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snJCddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnJCddIDogbnVsbCk7XHJcblxyXG52YXIgU2ltcGxlUmVuZGVyZXIgPSB7XHJcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgkY29udGFpbmVyLCBoZWFkZXIsIGRhdGEpIHtcclxuICAgICAgICB0aGlzLnBvcHVsYXRlKGRhdGEpO1xyXG4gICAgICAgIHRoaXMuc2hvd0ZpbHRlcih0aGlzLiRkb20sICRjb250YWluZXIsIGhlYWRlciwgZGF0YSk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICBzaG93RmlsdGVyOiBmdW5jdGlvbigkZG9tLCAkY29udGFpbmVyLCBoZWFkZXIsIGRhdGEpIHtcclxuICAgICAgICAkY29udGFpbmVyLmFwcGVuZCh0aGlzLiRkb20pO1xyXG4gICAgICAgIHRoaXMuJGRvbS5hdHRyKCduYW1lJywgaGVhZGVyKS5hdHRyKCdwbGFjZWhvbGRlcicsIGhlYWRlcikuc2hvdygpO1xyXG4gICAgfSxcclxuXHJcbiAgICByZWZyZXNoOiBmdW5jdGlvbiAoZGF0YSkge1xyXG4gICAgICAgIHRoaXMudXBkYXRlKGRhdGEpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gU2ltcGxlUmVuZGVyZXI7IiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snJCddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnJCddIDogbnVsbCk7XHJcbnZhciBCYXNlRmlsdGVyID0gcmVxdWlyZSgnLi4vYmFzZWZpbHRlcicpO1xyXG52YXIgU2ltcGxlUmVuZGVyZXIgPSByZXF1aXJlKCcuLi9yZW5kZXJlci9zaW1wbGUnKTtcclxudmFyIEJvb3RzdHJhcFJlbmRlcmVyID0gcmVxdWlyZSgnLi9yZW5kZXJlci9ib290c3RyYXAnKTtcclxudmFyIENob3NlblJlbmRlciA9IHJlcXVpcmUoJy4vcmVuZGVyZXIvY2hvc2VuJyk7XHJcblxyXG4vKipcclxuICogU2VsZWN0RmlsdGVyIHJlZ3JvdXBzIGNvbW1vbiBiZWhhdmlvciBmb3Igc2VsZWN0IGZpbHRlcnNcclxuICovXHJcbnZhciBTZWxlY3RGaWx0ZXIgPSAkLmV4dGVuZCh7fSwgQmFzZUZpbHRlciwge1xyXG4gICAgc2VsZWN0ZWQ6IFtdLFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyBhbiBhbHdheXMgZmFsc2UgcmVnZXggdG8gaGlkZSBldmVyeSByZWNvcmRzXHJcbiAgICAgKiB3aGVuIG5vIG9wdGlvbiBpcyBzZWxlY3RlZFxyXG4gICAgICovXHJcbiAgICBub1NlbGVjdGlvblF1ZXJ5OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuICckLl4nO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlLiBTZWxlY3QgZmlsdGVycyBhbHdheXMgdXNlIHJlZ2V4XHJcbiAgICAgKi9cclxuICAgIGlzUmVnZXhNYXRjaDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIHRydWUgaWYgYXQgbGVhc3Qgb25lIG9wdGlvbiBpcyBzZWxlY3RlZFxyXG4gICAgICovXHJcbiAgICBoYXNWYWx1ZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9nZXRTZWxlY3Rpb24oKS5sZW5ndGggPiAwO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBjb2x1bW4gZmlsdGVyIHF1ZXJ5IHRvIGFwcGx5LiBTZWxlY3RlZCBvcHRpb24gdmFsdWVzXHJcbiAgICAgKiBhcmUgY29uY2F0ZW5hdGVkIGludG8gYSBzdHJpbmcgdXNpbmcgdGhlIHBpcGUgY2hhcmFjdGVyIChyZWdleCBvcilcclxuICAgICAqL1xyXG4gICAgc2VsZWN0ZWRRdWVyeTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9nZXRTZWxlY3Rpb24oKS5tYXAoZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICAgICAgICAgIGlmICh2YWx1ZSA9PSB0aGlzLmFsbFRleHQgIHx8IHRoaXMuX2dldE5vdFNlbGVjdGVkKCkubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gJyc7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gJ14nICsgJC5mbi5kYXRhVGFibGUudXRpbC5lc2NhcGVSZWdleCh2YWx1ZSkgKyAnJCc7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LCB0aGlzKS5qb2luKCd8Jyk7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRmlsdGVycyB0aGUgb3B0aW9ucyBiZWZvcmUgYWRkaW5nIHRoZW0gdG8gdGhlIHNlbGVjdC4gQ2FuIGJlIG92ZXJyaWRkZW5cclxuICAgICAqIGZvciBzcGVjaWZpYyBmaWx0ZXJpbmdcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0gdmFsdWUge1N0cmluZ30gT3B0aW9uIHZhbHVlXHJcbiAgICAgKi9cclxuICAgIGZpbHRlck9wdGlvbnM6IGZ1bmN0aW9uICh2YWx1ZSkge1xyXG4gICAgICAgIHJldHVybiB2YWx1ZS50cmltKCkgIT0gJyc7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogU29ydCB0aGUgb3B0aW9ucyBiZWZvcmUgYWRkaW5nIHRoZW0gdG8gdGhlIHNlbGVjdC4gQ2FuIGJlIG92ZXJyaWRkZW4gZm9yXHJcbiAgICAgKiBzcGVjaWZpYyBzb3J0c1xyXG4gICAgICovXHJcbiAgICBzb3J0T3B0aW9uczogZnVuY3Rpb24gKGEsIGIpIHtcclxuICAgICAgICBpZiAoYSA+IGIpIHtcclxuICAgICAgICAgICAgcmV0dXJuIDE7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoYSA8IGIpIHtcclxuICAgICAgICAgICAgcmV0dXJuIC0xO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIDA7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHJldHVybnMge0FycmF5PFN0cmluZz59IFRoZSBhcnJheSBvZiBzZWxlY3RlZCB2YWx1ZXNcclxuICAgICAqIEBwcml2YXRlXHJcbiAgICAgKi9cclxuICAgIF9nZXRTZWxlY3Rpb246IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy4kZG9tLmZpbmQoJ29wdGlvbjpzZWxlY3RlZCcpLnRvQXJyYXkoKS5tYXAoZnVuY3Rpb24ob3B0aW9uKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBvcHRpb24udmFsdWU7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHsqfEFycmF5fSBUaGUgYXJyYXkgb2Ygbm9uIHNlbGVjdGVkIHZhbHVlc1xyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqL1xyXG4gICAgX2dldE5vdFNlbGVjdGVkOiBmdW5jdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy4kZG9tLmZpbmQoJzpub3Qob3B0aW9uOnNlbGVjdGVkKScpLnRvQXJyYXkoKS5tYXAoZnVuY3Rpb24ob3B0aW9uKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBvcHRpb24udmFsdWU7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRm9yIGVhY2ggZWxlbWVudCBpbiB0aGUgZGF0YSBvYmplY3QsIGNyZWF0ZXMgYW4gb3B0aW9uIGVsZW1lbnQgdXNpbmcgdGhlIGZ1bmN0aW9uXHJcbiAgICAgKiBmbkNyZWF0ZVxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSBkYXRhIHtqUXVlcnl9IFRoZSBkYXRhIHRvIGFkZCB0byB0aGUgc2VsZWN0XHJcbiAgICAgKiBAcGFyYW0gZm5DcmVhdGUge0Z1bmN0aW9ufSBUaGUgZnVuY3Rpb24gdG8gdXNlIHRvIGNyZWF0ZSB0aGUgb3B0aW9uc1xyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqL1xyXG4gICAgX2FkZE9wdGlvbnM6IGZ1bmN0aW9uIChkYXRhLCBmbkNyZWF0ZSkge1xyXG4gICAgICAgIHRoaXMuJGRvbS5lbXB0eSgpO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5hbGxUZXh0KVxyXG4gICAgICAgICAgICBmbkNyZWF0ZS5jYWxsKHRoaXMsIHRoaXMuYWxsVGV4dCk7XHJcblxyXG4gICAgICAgIGRhdGEudG9BcnJheSgpLmZpbHRlcih0aGlzLmZpbHRlck9wdGlvbnMpLnNvcnQodGhpcy5zb3J0T3B0aW9ucykuZm9yRWFjaChmbkNyZWF0ZSwgdGhpcyk7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhIHNlbGVjdGVkIG9wdGlvblxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSB2YWx1ZSB7U3RyaW5nfSBUaGUgb3B0aW9uIHZhbHVlXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICovXHJcbiAgICBfYWRkU2VsZWN0ZWRPcHRpb246IGZ1bmN0aW9uICh2YWx1ZSkge1xyXG4gICAgICAgIHRoaXMuJGRvbS5hcHBlbmQoJCgnPG9wdGlvbi8+JylcclxuICAgICAgICAgICAgLnZhbCh2YWx1ZSlcclxuICAgICAgICAgICAgLnRleHQodmFsdWUpXHJcbiAgICAgICAgICAgIC5hdHRyKCdzZWxlY3RlZCcsICdzZWxlY3RlZCcpXHJcbiAgICAgICAgKTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGFuIG9wdGlvbiB3aXRoIHRoZSBzZWxlY3RlZCBmbGFnIGJhc2VkIG9uIHRoZVxyXG4gICAgICogY3VycmVudCBmaWx0ZXIgc3RhdGVcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0gdmFsdWUge1N0cmluZ30gVGhlIG9wdGlvbiB2YWx1ZVxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqL1xyXG4gICAgX3JlZnJlc2hPcHRpb246IGZ1bmN0aW9uICh2YWx1ZSkge1xyXG4gICAgICAgIHZhciAkb3B0aW9uID0gJCgnPG9wdGlvbi8+JylcclxuICAgICAgICAgICAgLnZhbCh2YWx1ZSlcclxuICAgICAgICAgICAgLnRleHQodmFsdWUpO1xyXG5cclxuICAgICAgICBpZiAoJC5pbkFycmF5KHZhbHVlLCB0aGlzLnNlbGVjdGVkKSA+IC0xKVxyXG4gICAgICAgICAgICAkb3B0aW9uLmF0dHIoJ3NlbGVjdGVkJywgJ3NlbGVjdGVkJyk7XHJcblxyXG4gICAgICAgIHRoaXMuJGRvbS5hcHBlbmQoJG9wdGlvbik7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogVGFrZXMgYSBzbmFwc2hvdCBvZiB0aGUgY3VycmVudCBzZWxlY3Rpb24gc3RhdGVcclxuICAgICAqXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICovXHJcbiAgICBfc2F2ZVNlbGVjdGlvbjogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdGhpcy5zZWxlY3RlZCA9IHRoaXMuX2dldFNlbGVjdGlvbigpO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIFdoZW5ldmVyIHRoZSBzZWxlY3Qgc3RhdGUgY2hhbmdlcywgc2F2ZSBpdHMgbmV3IHN0YXRlIGFuZFxyXG4gICAgICogbm90aWZ5IHRoZSBsaXN0ZW5pbmcgY29tcG9uZW50XHJcbiAgICAgKlxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqL1xyXG4gICAgX29uQ2hhbmdlOiBmdW5jdGlvbigpIHtcclxuICAgICAgICB0aGlzLl9zYXZlU2VsZWN0aW9uKCk7XHJcbiAgICAgICAgdGhpcy5ub3RpZnlDaGFuZ2UoKTtcclxuICAgIH1cclxufSk7XHJcblxyXG4gdmFyIGF2YWlsYWJsZVJlbmRlcmVycyA9IHtcclxuICAgICdib290c3RyYXAnOiBCb290c3RyYXBSZW5kZXJlcixcclxuICAgICdjaG9zZW4nOiBDaG9zZW5SZW5kZXJcclxufTtcclxuXHJcbnZhciBidWlsZGVyID0gZnVuY3Rpb24oc2V0dGluZ3MpIHtcclxuICAgIHZhciByZW5kZXJlciA9IGF2YWlsYWJsZVJlbmRlcmVyc1tzZXR0aW5ncy5yZW5kZXJlcl0gfHwgU2ltcGxlUmVuZGVyZXI7XHJcblxyXG4gICAgcmV0dXJuICQuZXh0ZW5kKHt9LCB0aGlzLCByZW5kZXJlciwgc2V0dGluZ3MpO1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBTZWxlY3RGaWx0ZXI6IFNlbGVjdEZpbHRlcixcclxuICAgIGJ1aWxkZXI6IGJ1aWxkZXJcclxufTsiLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgJCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WyckJ10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWyckJ10gOiBudWxsKTtcclxudmFyIEZpbHRlcnMgPSByZXF1aXJlKCcuLi9maWx0ZXJzJyk7XHJcbnZhciBCYXNlU2VsZWN0ID0gcmVxdWlyZSgnLi9iYXNlc2VsZWN0Jyk7XHJcblxyXG52YXIgRml4ZWRTZWxlY3RGaWx0ZXIgPSAkLmV4dGVuZCh7fSwgQmFzZVNlbGVjdC5TZWxlY3RGaWx0ZXIsIHtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFNpbXBseSBzYXZlcyBhIGhhbmRsZSBvbiB0aGUgcHJvdmlkZWQgc291cmNlIHNlbGVjdFxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtGaXhlZFNlbGVjdEZpbHRlcn1cclxuICAgICAqL1xyXG4gICAgaW5pdDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMuJGRvbSA9ICQodGhpcy5zcmMpO1xyXG4gICAgICAgIHRoaXMuJGRvbS5vbignY2hhbmdlJywgdGhpcy5ub3RpZnlDaGFuZ2UuYmluZCh0aGlzKSk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIE5vIGFjdGlvbiBmb3IgZml4ZWQgZmlsdGVyczogdGhlIHByb3ZpZGVkIHNlbGVjdCBpcyB1c2VkIGFzIGlzXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge0ZpeGVkU2VsZWN0RmlsdGVyfVxyXG4gICAgICovXHJcbiAgICBwb3B1bGF0ZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIE5vIHVwZGF0ZSBmb3IgZml4ZWQgZmlsdGVyczogdGhlIHByb3ZpZGVkIHNlbGVjdCBpcyBuZXZlciBjaGFuZ2VkXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge0ZpeGVkU2VsZWN0RmlsdGVyfVxyXG4gICAgICovXHJcbiAgICB1cGRhdGU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBGaXhlZCBmaWx0ZXJzIGNhbiBiZSB1c2VkIHRvIHByb3ZpZGUgaW5pdGlhbCBmaWx0ZXJzIHRvIGFwcGx5IHRvIHRoZVxyXG4gICAgICogZGF0YXRhYmxlLlxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHsqfFN0cmluZ31cclxuICAgICAqL1xyXG4gICAgZ2V0SW5pdGlhbFF1ZXJ5OiBmdW5jdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5nZXRRdWVyeSgpO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbkZpbHRlcnMucHJvdG90eXBlLmJ1aWxkZXJzLmZpeGVkc2VsZWN0ID0gQmFzZVNlbGVjdC5idWlsZGVyLmJpbmQoRml4ZWRTZWxlY3RGaWx0ZXIpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBGaXhlZFNlbGVjdEZpbHRlcjsiLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgJCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WyckJ10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWyckJ10gOiBudWxsKTtcclxudmFyIEZpbHRlcnMgPSByZXF1aXJlKCcuLi9maWx0ZXJzJyk7XHJcbnZhciBCYXNlU2VsZWN0ID0gcmVxdWlyZSgnLi9iYXNlc2VsZWN0Jyk7XHJcblxyXG52YXIgTXVsdGlTZWxlY3RGaWx0ZXIgPSAkLmV4dGVuZCh7fSwgQmFzZVNlbGVjdC5TZWxlY3RGaWx0ZXIsIHtcclxuXHJcbiAgICAvKipcclxuICAgICAqIEluaXRpYWxpemVzIGEgbXVsdGlzZWxlY3QgZG9tIG9iamVjdFxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtNdWx0aVNlbGVjdEZpbHRlcn1cclxuICAgICAqL1xyXG4gICAgaW5pdDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMuJGRvbSA9ICQoJzxzZWxlY3QgY2xhc3M9XCJmaWx0cmVcIi8+JykuYXR0cignbXVsdGlwbGUnLCAnbXVsdGlwbGUnKTtcclxuICAgICAgICB0aGlzLiRkb20ub24oJ2NoYW5nZScsIHRoaXMuX29uQ2hhbmdlLmJpbmQodGhpcykpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBQb3B1bGF0ZXMgdGhlIG11bHRpc2VsZWN0IHdpdGggJ3NlbGVjdGVkJyBvcHRpb25zIGJ5IGRlZmF1bHRcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0gZGF0YVxyXG4gICAgICogQHJldHVybnMge011bHRpU2VsZWN0RmlsdGVyfVxyXG4gICAgICovXHJcbiAgICBwb3B1bGF0ZTogZnVuY3Rpb24gKGRhdGEpIHtcclxuICAgICAgICB0aGlzLl9hZGRPcHRpb25zKGRhdGEsIHRoaXMuX2FkZFNlbGVjdGVkT3B0aW9uKTtcclxuICAgICAgICB0aGlzLl9vbkNoYW5nZSgpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBJZiB0aGUgJ2FsbCcgb3B0aW9uIGlzIHNlbGVjdGVkLCBzZXRzIHRoZSBuZXcgb3B0aW9ucyBhcyAnc2VsZWN0ZWQnLlxyXG4gICAgICogT3RoZXJ3aXNlLCBhZGRzIHRoZSBvcHRpb25zIGJhc2VkIG9uIHRoZSBmaWx0ZXIgc3RhdGVcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0gZGF0YVxyXG4gICAgICogQHJldHVybnMge011bHRpU2VsZWN0RmlsdGVyfVxyXG4gICAgICovXHJcbiAgICB1cGRhdGU6IGZ1bmN0aW9uIChkYXRhKSB7XHJcbiAgICAgICAgaWYgKCQuaW5BcnJheSh0aGlzLmFsbFRleHQsIHRoaXMuc2VsZWN0ZWQpID4gLTEgfHwgdGhpcy5fZ2V0Tm90U2VsZWN0ZWQoKS5sZW5ndGggPT0gMClcclxuICAgICAgICAgICAgdGhpcy5fYWRkT3B0aW9ucyhkYXRhLCB0aGlzLl9hZGRTZWxlY3RlZE9wdGlvbik7XHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICB0aGlzLl9hZGRPcHRpb25zKGRhdGEsIHRoaXMuX3JlZnJlc2hPcHRpb24pO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUaGlzIGZpbHRlciBpcyBkeW5hbWljLCBpdCBjYW4ndCBiZSB1c2VkIGZvciBpbml0aWFsIGZpbHRlcmluZ1xyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9XHJcbiAgICAgKi9cclxuICAgIGdldEluaXRpYWxRdWVyeTogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgcmV0dXJuICcnO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbkZpbHRlcnMucHJvdG90eXBlLmJ1aWxkZXJzLm11bHRpc2VsZWN0ID0gQmFzZVNlbGVjdC5idWlsZGVyLmJpbmQoTXVsdGlTZWxlY3RGaWx0ZXIpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBNdWx0aVNlbGVjdEZpbHRlcjsiLCIndXNlIHN0cmljdCc7XHJcbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJyQnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJyQnXSA6IG51bGwpO1xyXG5cclxudmFyIEJvb3RzdHJhcFJlbmRlcmVyID0ge1xyXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoJGNvbnRhaW5lciwgaGVhZGVyLCBkYXRhKSB7XHJcbiAgICAgICAgdGhpcy5wb3B1bGF0ZShkYXRhKTtcclxuICAgICAgICB0aGlzLnNob3dGaWx0ZXIodGhpcy4kZG9tLCAkY29udGFpbmVyLCBoZWFkZXIsIGRhdGEpO1xyXG5cclxuICAgICAgICB2YXIgZGVmYXVsdE9wdGlvbnMgPSB7XHJcbiAgICAgICAgICAgIGJ1dHRvblRleHQ6IGZ1bmN0aW9uIChvcHRpb25zKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgbmJTZWxlY3RlZCA9ICQob3B0aW9ucykuZmlsdGVyKCc6c2VsZWN0ZWQnKS5sZW5ndGg7XHJcbiAgICAgICAgICAgICAgICBpZihuYlNlbGVjdGVkID09IDApIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaGVhZGVyO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGhlYWRlciArICcgKCcgKyBuYlNlbGVjdGVkICsgJyknO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy4kZG9tLm11bHRpc2VsZWN0KCQuZXh0ZW5kKGRlZmF1bHRPcHRpb25zLCB0aGlzLnJlbmRlcmVyT3B0aW9ucykpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgc2VsZWN0ZWRRdWVyeTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciAkd2lkZ2V0ID0gdGhpcy4kZG9tLm11bHRpc2VsZWN0KCk7XHJcblxyXG4gICAgICAgIGlmICgkLmluQXJyYXkoJHdpZGdldC5zZWxlY3RBbGxUZXh0LCAkd2lkZ2V0LnZhbCgpKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gJyc7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2dldFNlbGVjdGlvbigpLm1hcChmdW5jdGlvbiAodmFsdWUpIHtcclxuICAgICAgICAgICAgICAgIGlmICh2YWx1ZSA9PSB0aGlzLmFsbFRleHQpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gJyc7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAnXicgKyAkLmZuLmRhdGFUYWJsZS51dGlsLmVzY2FwZVJlZ2V4KHZhbHVlKSArICckJztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSwgdGhpcykuam9pbignfCcpO1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcblxyXG4gICAgc2hvd0ZpbHRlcjogZnVuY3Rpb24oJGRvbSwgJGNvbnRhaW5lciwgaGVhZGVyLCBkYXRhKSB7XHJcbiAgICAgICAgJGNvbnRhaW5lci5hcHBlbmQodGhpcy4kZG9tKTtcclxuICAgIH0sXHJcblxyXG4gICAgcmVmcmVzaDogZnVuY3Rpb24gKGRhdGEpIHtcclxuICAgICAgICB0aGlzLnVwZGF0ZShkYXRhKTtcclxuICAgICAgICB0aGlzLiRkb20ubXVsdGlzZWxlY3QoJ3JlYnVpbGQnKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEJvb3RzdHJhcFJlbmRlcmVyOyIsIid1c2Ugc3RyaWN0JztcclxudmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snJCddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnJCddIDogbnVsbCk7XHJcblxyXG52YXIgQ2hvc2VuUmVuZGVyZXIgPSB7XHJcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgkY29udGFpbmVyLCBoZWFkZXIsIGRhdGEpIHtcclxuICAgICAgICB0aGlzLnBvcHVsYXRlKGRhdGEpO1xyXG4gICAgICAgIHRoaXMuc2hvd0ZpbHRlcih0aGlzLiRkb20sICRjb250YWluZXIsIGhlYWRlciwgZGF0YSk7XHJcbiAgICAgICAgdGhpcy4kZG9tLmNob3Nlbih0aGlzLnJlbmRlcmVyT3B0aW9ucyB8fCB7fSk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICBzaG93RmlsdGVyOiBmdW5jdGlvbigkZG9tLCAkY29udGFpbmVyLCBoZWFkZXIsIGRhdGEpIHtcclxuICAgICAgICAkY29udGFpbmVyLmFwcGVuZCh0aGlzLiRkb20pO1xyXG4gICAgfSxcclxuXHJcbiAgICByZWZyZXNoOiBmdW5jdGlvbiAoZGF0YSkge1xyXG4gICAgICAgIHRoaXMudXBkYXRlKGRhdGEpO1xyXG4gICAgICAgIHRoaXMuJGRvbS50cmlnZ2VyKCdjaG9zZW46dXBkYXRlZCcpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQ2hvc2VuUmVuZGVyZXI7IiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snJCddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnJCddIDogbnVsbCk7XHJcbnZhciBGaWx0ZXJzID0gcmVxdWlyZSgnLi4vZmlsdGVycycpO1xyXG52YXIgQmFzZVNlbGVjdCA9IHJlcXVpcmUoJy4vYmFzZXNlbGVjdCcpO1xyXG5cclxudmFyIFNpbXBsZVNlbGVjdEZpbHRlciA9ICQuZXh0ZW5kKHt9LCBCYXNlU2VsZWN0LlNlbGVjdEZpbHRlciwge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhIHNpbXBsZSBzZWxlY3RcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7U2ltcGxlU2VsZWN0RmlsdGVyfVxyXG4gICAgICovXHJcbiAgICBpbml0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy4kZG9tID0gJCgnPHNlbGVjdCBjbGFzcz1cImZpbHRyZVwiLz4nKTtcclxuICAgICAgICB0aGlzLiRkb20ub24oJ2NoYW5nZScsIHRoaXMuX29uQ2hhbmdlLmJpbmQodGhpcykpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBBZGRzIGFsbCBvcHRpb25zIHdpdGhvdXQgc3BlY2lmeWluZyB0aGUgJ3NlbGVjdGVkJyBmbGFnXHJcbiAgICAgKiAodGhlIGZpcnN0IG9wdGlvbiBpcyBzZWxlY3RlZCBieSBkZWZhdWx0KVxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSBkYXRhXHJcbiAgICAgKiBAcmV0dXJucyB7U2ltcGxlU2VsZWN0RmlsdGVyfVxyXG4gICAgICovXHJcbiAgICBwb3B1bGF0ZTogZnVuY3Rpb24gKGRhdGEpIHtcclxuICAgICAgICB0aGlzLl9hZGRPcHRpb25zKGRhdGEsIHRoaXMuX3JlZnJlc2hPcHRpb24pO1xyXG4gICAgICAgIHRoaXMuX29uQ2hhbmdlKCk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIFJlZnJlc2ggdGhlIG9wdGlvbnMgYmFzZWQgb24gdGhlIGZpbHRlciBzdGF0ZVxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSBkYXRhXHJcbiAgICAgKiBAcmV0dXJucyB7U2ltcGxlU2VsZWN0RmlsdGVyfVxyXG4gICAgICovXHJcbiAgICB1cGRhdGU6IGZ1bmN0aW9uIChkYXRhKSB7XHJcbiAgICAgICAgdGhpcy5fYWRkT3B0aW9ucyhkYXRhLCB0aGlzLl9yZWZyZXNoT3B0aW9uKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogVGhpcyBmaWx0ZXIgaXMgZHluYW1pYywgaXQgY2FuJ3QgYmUgdXNlZCBmb3IgaW5pdGlhbCBmaWx0ZXJpbmdcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfVxyXG4gICAgICovXHJcbiAgICBnZXRJbml0aWFsUXVlcnk6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHJldHVybiAnJztcclxuICAgIH1cclxufSk7XHJcblxyXG5GaWx0ZXJzLnByb3RvdHlwZS5idWlsZGVycy5zZWxlY3QgPSBCYXNlU2VsZWN0LmJ1aWxkZXIuYmluZChTaW1wbGVTZWxlY3RGaWx0ZXIpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBTaW1wbGVTZWxlY3RGaWx0ZXI7Il19
