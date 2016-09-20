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
},{"./filters":2,"./input/input":3,"./select/fixedselect":7,"./select/multiselect":8,"./select/simpleselect":10}],5:[function(require,module,exports){
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

var builder = function(settings) {
    var renderer = SimpleRenderer;

    if (settings.renderer == 'bootstrap')
        renderer = BootstrapRenderer;

    return $.extend({}, this, renderer, settings);
};

module.exports = {
    SelectFilter: SelectFilter,
    builder: builder
};
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../basefilter":1,"../renderer/simple":5,"./renderer/bootstrap":9}],7:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJqcy9iYXNlZmlsdGVyLmpzIiwianMvZmlsdGVycy5qcyIsImpzL2lucHV0L2lucHV0LmpzIiwianMvbWFpbi5qcyIsImpzL3JlbmRlcmVyL3NpbXBsZS5qcyIsImpzL3NlbGVjdC9iYXNlc2VsZWN0LmpzIiwianMvc2VsZWN0L2ZpeGVkc2VsZWN0LmpzIiwianMvc2VsZWN0L211bHRpc2VsZWN0LmpzIiwianMvc2VsZWN0L3JlbmRlcmVyL2Jvb3RzdHJhcC5qcyIsImpzL3NlbGVjdC9zaW1wbGVzZWxlY3QuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDaERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ2pSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDakRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUN4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNsTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDbkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDN0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ25EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcblxudmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snJCddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnJCddIDogbnVsbCk7XG5cbi8qKlxuICogQmFzZUZpbHRlclxuICovXG52YXIgQmFzZUZpbHRlciA9IHtcblxuICAgIC8qKlxuICAgICAqIEByZXR1cm5zIHtCb29sZWFufSBXaGV0aGVyIGEgZmlsdGVyIGNoYW5nZSBtdXN0IHRyaWdnZXIgYSBkYXRhdGFibGUgcmVsb2FkLlxuICAgICAqIERlZmF1bHQgaXMgZmFsc2UgKGNsaWVudCBzaWRlIGZpbHRlcikuXG4gICAgICovXG4gICAgaXNTZXJ2ZXJTaWRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHJldHVybnMge1N0cmluZ30gVGhlIHJlcXVlc3QgcGFyYW1ldGVyIGFzc29jaWF0ZWQgd2l0aCB0aGlzIGZpbHRlciAoaW4gdGhlIGZvcm0ga2V5PXBhcmFtLFxuICAgICAqIG9ubHkgdXNlZCBmb3Igc2VydmVyIHNpZGUgZmlsdGVycylcbiAgICAgKi9cbiAgICBnZXRTZXJ2ZXJRdWVyeTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gJyc7XG4gICAgfSxcblxuICAgIG5vdGlmeUNoYW5nZTogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLiRkb20udHJpZ2dlcigndXBkYXRlLmZpbHRlcnMuZHQnLCB7XG4gICAgICAgICAgICBmaWx0ZXI6IHRoaXNcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBmaWx0ZXIgc3RyaW5nIHRvIGJlIGFwcGxpZWQgdG8gdGhlIGRhdGF0YWJsZSBjb2x1bW5cbiAgICAgKi9cbiAgICBnZXRRdWVyeTogZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoIXRoaXMuaGFzVmFsdWUoKSlcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm5vU2VsZWN0aW9uUXVlcnkoKTtcblxuICAgICAgICByZXR1cm4gdGhpcy5zZWxlY3RlZFF1ZXJ5KCk7XG4gICAgfSxcblxuICAgIHJlZ2lzdGVyOiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgICB0aGlzLiRkb20ub24oJ3VwZGF0ZS5maWx0ZXJzLmR0JywgY2FsbGJhY2spO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQmFzZUZpbHRlcjsiLCIndXNlIHN0cmljdCc7XG5cbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJyQnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJyQnXSA6IG51bGwpO1xuXG4vKipcbiAqIEZpbHRlcnMgaXMgYSBjb21wb25lbnQgdGhhdCBtYW5hZ2VzIGEgbGlzdCBvZiBmaWx0ZXJzIG9iamVjdCBpbnNpZGVcbiAqIGEgZGF0YXRhYmxlIGhlYWRlciByb3cuXG4gKlxuICogVGhpcyBjb25zdHJ1Y3RvciBiaW5kcyBsaXN0ZW5lcnMgdG8gdmFyaW91cyBkYXRhdGFibGUgZXZlbnRzLlxuICpcbiAqIEBwYXJhbSBzZXR0aW5ncyB7T2JqZWN0fSBzZXR0aW5ncyBvYmplY3QgdXNlZCB0byBjcmVhdGUgdGhlIGRhdGF0YWJsZVxuICovXG52YXIgRmlsdGVycyA9IGZ1bmN0aW9uIChzZXR0aW5ncykge1xuICAgIHRoaXMudGFibGVBUEkgPSBuZXcgJC5mbi5kYXRhVGFibGUuQXBpKHNldHRpbmdzKTtcbiAgICB0aGlzLiRoZWFkZXIgPSAkKHRoaXMudGFibGVBUEkudGFibGUoKS5oZWFkZXIoKSk7XG4gICAgdGhpcy51cmwgPSB0aGlzLnRhYmxlQVBJLmFqYXgudXJsKCk7XG5cbiAgICB2YXIgZmlsdGVycyA9IFtdO1xuICAgIHZhciBidWlsZGVycyA9IHRoaXMuYnVpbGRlcnM7XG4gICAgdmFyIHJlbmRlckNvbCA9IDA7XG4gICAgJC5lYWNoKHNldHRpbmdzLmFvQ29sdW1ucywgZnVuY3Rpb24gKGNvbCwgcGFyYW0pIHtcbiAgICAgICAgaWYgKHBhcmFtLmZpbHRlcikge1xuICAgICAgICAgICAgdmFyIG9wdGlvbnMgPSAkLmV4dGVuZCh7XG4gICAgICAgICAgICAgIGNvbHVtbjogY29sLFxuICAgICAgICAgICAgICByZW5kZXJDb2x1bW46IHJlbmRlckNvbFxuICAgICAgICAgICAgfSwgcGFyYW0uZmlsdGVyKTtcbiAgICAgICAgICAgIGZpbHRlcnMucHVzaChidWlsZGVyc1twYXJhbS5maWx0ZXIudHlwZV0ob3B0aW9ucykpO1xuICAgICAgICB9XG4gICAgICAgIGlmKHBhcmFtLmJWaXNpYmxlKSB7XG4gICAgICAgICAgcmVuZGVyQ29sKys7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmIChmaWx0ZXJzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgdGhpcy5maWx0ZXJzID0gZmlsdGVycztcbiAgICAgICAgdGhpcy5maWx0ZXJzLmZvckVhY2goZnVuY3Rpb24gKGZpbHRlcikge1xuICAgICAgICAgICAgZmlsdGVyLmluaXQoKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuZmlsdGVycy5mb3JFYWNoKHRoaXMuYXBwbHlJbml0aWFsRmlsdGVyLCB0aGlzKTtcbiAgICAgICAgdGhpcy50YWJsZUFQSS5vbignaW5pdCcsIHRoaXMub25EYXRhVGFibGVJbml0LmJpbmQodGhpcykpO1xuICAgIH1cbn07XG5cbiQuZXh0ZW5kKEZpbHRlcnMucHJvdG90eXBlLCB7XG5cbiAgICAvKipcbiAgICAgKiBBcnJheSBvZiBmaWx0ZXIgY29uc3RydWN0b3IgZnVuY3Rpb24uIEVhY2ggZnVuY3Rpb25cbiAgICAgKiB0YWtlcyBhIHNldHRpbmcgb2JqZWN0IGFzIGl0cyBzaW5nbGUgcGFyYW1ldGVyXG4gICAgICovXG4gICAgYnVpbGRlcnM6IHt9LFxuXG4gICAgLyoqXG4gICAgICogVGFibGUgaGVhZGVyIGRvbSBub2RlXG4gICAgICogQHR5cGUge2pRdWVyeX1cbiAgICAgKi9cbiAgICAkaGVhZGVyOiBudWxsLFxuXG4gICAgLyoqXG4gICAgICogRmlsdGVycyBhcnJheVxuICAgICAqIEB0eXBlIHtBcnJheX1cbiAgICAgKi9cbiAgICBmaWx0ZXJzOiBbXSxcblxuICAgIC8qKlxuICAgICAqIFRhYmxlIGluaXRpYWwgYWpheCBVUkxcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAqL1xuICAgIHVybDogJycsXG5cbiAgICAvKipcbiAgICAgKiBSZWZyZXNoZXMgZmlsdGVycyBhZnRlciBlYWNoIGFqYXggcmVxdWVzdFxuICAgICAqXG4gICAgICogQHJldHVybnMge0ZpbHRlcnN9XG4gICAgICovXG4gICAgcmVnaXN0ZXJBamF4TGlzdGVuZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy50YWJsZUFQSS5vbigneGhyJywgJC5wcm94eShmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLnRhYmxlQVBJLm9uZSgncHJlRHJhdycsICQucHJveHkodGhpcy5yZWZyZXNoRmlsdGVycywgdGhpcykpO1xuICAgICAgICB9LCB0aGlzKSk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEluaXRpYWxpemVzIHRoZSBoZWFkZXIgSFRNTCBlbGVtZW50cyB0aGF0IHdpbGwgYmUgdXNlZCB0byBob2xkIHRoZSBmaWx0ZXJzLlxuICAgICAqIEl0IGFsc28gcmVnaXN0ZXJzIHRoZSBtYWluIGV2ZW50IGhhbmRsZXIgdGhhdCB3aWxsIHJlYWN0IHRvIHRoZSBmaWx0ZXJzJ1xuICAgICAqIHZhbHVlIGNoYW5nZXMuXG4gICAgICpcbiAgICAgKiBUaGUgZXZlbnQgbmFtZSBpcyA8Yj5maWx0ZXJDaGFuZ2U8L2I+LiBUaGlzIGV2ZW50IG11c3QgYmUgdHJpZ2dlcmVkIGJ5IHRoZVxuICAgICAqIGZpbHRlcnMgd2hlbiB0aGVpciB2YWx1ZSBpcyBtb2RpZmllZCBieSB0aGUgdXNlciAob3IgYW55IG90aGVyIGV2ZW50IHRoYXRcbiAgICAgKiBzaG91bGQgdHJpZ2dlciBhIGRhdGF0YWJsZSBmaWx0ZXIpLlxuICAgICAqXG4gICAgICogQHJldHVybnMge0ZpbHRlcnN9XG4gICAgICovXG4gICAgc2V0dXBIZWFkZXJSb3c6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyICRmaWx0ZXJIZWFkZXIgPSAkKCc8dHIgY2xhc3M9XCJmaWx0ZXJzXCI+PC90cj4nKTtcblxuICAgICAgICB0aGlzLnRhYmxlQVBJLmNvbHVtbnMoJzp2aXNpYmxlJykuaGVhZGVyKCkuZWFjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAkZmlsdGVySGVhZGVyLmFwcGVuZCgnPHRoIGNsYXNzPVwiZm9uZC1oZWFkZXJcIj48L3RoPicpO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLiRoZWFkZXIuYXBwZW5kKCRmaWx0ZXJIZWFkZXIpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZWRyYXdzIHRoZSBkYXRhdGFibGVcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJzfVxuICAgICAqL1xuICAgIGRyYXdUYWJsZTogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnRhYmxlQVBJLmRyYXcoKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0cmlldmVzIHRoZSBjb2x1bW4gZGF0YSAoY3VycmVudCBmaWx0ZXIgaXMgaWdub3JlZClcbiAgICAgKlxuICAgICAqIEBwYXJhbSBjb2wge2ludH0gVGhlIGNvbHVtbiBpbmRleCAoMCBiYXNlZClcbiAgICAgKlxuICAgICAqIEByZXR1cm4ge2pRdWVyeX0gVGhlIHVuZmlsdGVyZWQgY29sdW1uIGRhdGFcbiAgICAgKi9cbiAgICBnZXRDb2x1bW5EYXRhOiBmdW5jdGlvbiAoY29sKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRhYmxlQVBJLmNvbHVtbihjb2wpLmRhdGEoKS51bmlxdWUoKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0cmlldmVzIHRoZSBjb2x1bW4gZmlsdGVyZWQgZGF0YVxuICAgICAqXG4gICAgICogQHBhcmFtIGNvbCB7aW50fSBUaGUgY29sdW1uIGluZGV4ICgwIGJhc2VkKVxuICAgICAqXG4gICAgICogQHJldHVybiB7alF1ZXJ5fSBUaGUgZmlsdGVyZWQgY29sdW1uIGRhdGFcbiAgICAgKi9cbiAgICBnZXRGaWx0ZXJlZENvbHVtbkRhdGE6IGZ1bmN0aW9uIChjb2wpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudGFibGVBUEkuY29sdW1uKGNvbCwge3NlYXJjaDogJ2FwcGxpZWQnfSkuZGF0YSgpLnVuaXF1ZSgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBY3Rpb25zIHRvIGV4ZWN1dGUgd2hlbiB0aGUgZGF0YXRhYmxlIGlzIGRvbmUgaW5pdGlhbGl6aW5nLlxuICAgICAqIENyZWF0ZXMgdGhlIGZpbHRlciBoZWFkZXIgcm93LCByZWdpc3RlcnMgYWpheCBsaXN0ZW5lcnMgYW5kXG4gICAgICogcmVuZGVycyBmaWx0ZXJzXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7RmlsdGVyc31cbiAgICAgKi9cbiAgICBvbkRhdGFUYWJsZUluaXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5zZXR1cEhlYWRlclJvdygpLnJlZ2lzdGVyQWpheExpc3RlbmVyKCkucmVuZGVyRmlsdGVycygpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBXaGVuIGEgY2xpZW50LXNpZGUgZmlsdGVyIGNoYW5nZXMsIGFwcGxpZXMgaXRzIG5ldyB2YWx1ZVxuICAgICAqXG4gICAgICogQHBhcmFtIGV2ZW50IHtFdmVudH0gZXZlbnQgb2JqZWN0XG4gICAgICogQHBhcmFtIHBhcmFtcyB7T2JqZWN0fSBldmVudCBwYXJhbXNcbiAgICAgKlxuICAgICAqIEByZXR1cm4ge0ZpbHRlcnN9XG4gICAgICovXG4gICAgb25DbGllbnRGaWx0ZXJDaGFuZ2U6IGZ1bmN0aW9uIChldmVudCwgcGFyYW1zKSB7XG4gICAgICAgIHRoaXMuYXBwbHlGaWx0ZXIocGFyYW1zLmZpbHRlcikuZHJhd1RhYmxlKCk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFdoZW4gYSBzZXJ2ZXItc2lkZSBmaWx0ZXIgY2hhbmdlcywgYnVpbGRzIHRoZSBuZXcgYWpheCBxdWVyeSBhbmQgcmVmcmVzaGVzIHRoZSB0YWJsZVxuICAgICAqXG4gICAgICogQHJldHVybiB7RmlsdGVyc31cbiAgICAgKi9cbiAgICBvblNlcnZlckZpbHRlckNoYW5nZTogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgc2VydmVyUXVlcnkgPSAkLmdyZXAodGhpcy5maWx0ZXJzLCBmdW5jdGlvbiAoZmlsdGVyKSB7XG4gICAgICAgICAgICByZXR1cm4gZmlsdGVyLmlzU2VydmVyU2lkZSgpO1xuICAgICAgICB9KS5tYXAoZnVuY3Rpb24gKGZpbHRlcikge1xuICAgICAgICAgICAgcmV0dXJuIGZpbHRlci5nZXRTZXJ2ZXJRdWVyeSgpO1xuICAgICAgICB9KS5qb2luKCcmJyk7XG5cbiAgICAgICAgdGhpcy50YWJsZUFQSS5hamF4LnVybCh0aGlzLnVybCArICc/JyArIHNlcnZlclF1ZXJ5KS5hamF4LnJlbG9hZCgpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBcHBsaWVzIHRoZSBmaWx0ZXIgdmFsdWUgdG8gdGhlIHJlbGF0ZWQgY29sdW1uXG4gICAgICpcbiAgICAgKiBAcGFyYW0gZmlsdGVyIFRoZSBmaWx0ZXIgb2JqZWN0XG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtGaWx0ZXJzfVxuICAgICAqL1xuICAgIGFwcGx5RmlsdGVyOiBmdW5jdGlvbiAoZmlsdGVyKSB7XG4gICAgICAgIHRoaXMudGFibGVBUEkuY29sdW1uKGZpbHRlci5jb2x1bW4pLnNlYXJjaChcbiAgICAgICAgICAgIGZpbHRlci5nZXRRdWVyeSgpLFxuICAgICAgICAgICAgZmlsdGVyLmlzUmVnZXhNYXRjaCgpXG4gICAgICAgICAgICAsIGZhbHNlKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogRW5hYmxlcyBmaWx0ZXJzIHRvIGFwcGx5IGFuIGluaXRpYWwgY29sdW1uIGZpbHRlciwgYmVmb3JlXG4gICAgICogYW55IGRhdGEgcHJvY2Vzc2luZy9kaXNwbGF5aW5nIGlzIGRvbmUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gZmlsdGVyXG4gICAgICogQHJldHVybnMge0ZpbHRlcnN9XG4gICAgICovXG4gICAgYXBwbHlJbml0aWFsRmlsdGVyOiBmdW5jdGlvbiAoZmlsdGVyKSB7XG4gICAgICAgIHRoaXMudGFibGVBUEkuY29sdW1uKGZpbHRlci5jb2x1bW4pLnNlYXJjaChcbiAgICAgICAgICAgIGZpbHRlci5nZXRJbml0aWFsUXVlcnkoKSxcbiAgICAgICAgICAgIGZpbHRlci5pc1JlZ2V4TWF0Y2goKVxuICAgICAgICAgICAgLCBmYWxzZSk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBzZWUgdGhpcy5yZW5kZXJGaWx0ZXJcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJzfVxuICAgICAqL1xuICAgIHJlbmRlckZpbHRlcnM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5maWx0ZXJzLmZvckVhY2godGhpcy5yZW5kZXJGaWx0ZXIsIHRoaXMpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBc2tzIGEgZmlsdGVyIHRvIHJlbmRlciBpdHNlbGYgYW5kIHByb3ZpZGVzIGFuIG9wdGlvbmFsIGNvbnRhaW5lclxuICAgICAqIGZvciBmaWx0ZXJzIHRoYXQgbmVlZCB0byBiZSByZW5kZXJlZCBpbnNpZGUgdGhlIGRhdGF0YWJsZSBoZWFkZXIgcm93XG4gICAgICpcbiAgICAgKiBAcGFyYW0gZmlsdGVyIFRoZSBmaWx0ZXIgb2JqZWN0XG4gICAgICovXG4gICAgcmVuZGVyRmlsdGVyOiBmdW5jdGlvbiAoZmlsdGVyKSB7XG4gICAgICAgIHZhciBjb2wgPSBmaWx0ZXIuY29sdW1uO1xuICAgICAgICB2YXIgJGNvbEhlYWRlciA9ICQodGhpcy50YWJsZUFQSS5jb2x1bW4oY29sKS5oZWFkZXIoKSk7XG4gICAgICAgIHZhciAkY29udGFpbmVyID0gdGhpcy4kaGVhZGVyLmZpbmQoJy5mb25kLWhlYWRlcjplcSgnICsgZmlsdGVyLnJlbmRlckNvbHVtbiArICcpJyk7XG5cbiAgICAgICAgaWYgKGZpbHRlci5pc1NlcnZlclNpZGUoKSkge1xuICAgICAgICAgICAgZmlsdGVyLnJlZ2lzdGVyKCQucHJveHkodGhpcy5vblNlcnZlckZpbHRlckNoYW5nZSwgdGhpcykpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZmlsdGVyLnJlZ2lzdGVyKCQucHJveHkodGhpcy5vbkNsaWVudEZpbHRlckNoYW5nZSwgdGhpcykpO1xuICAgICAgICB9XG5cbiAgICAgICAgZmlsdGVyLnJlbmRlcigkY29udGFpbmVyLCAkY29sSGVhZGVyLmh0bWwoKSwgdGhpcy5nZXRDb2x1bW5EYXRhKGNvbCkpO1xuICAgICAgICBpZihmaWx0ZXIuY2xhc3NOYW1lKSB7XG4gICAgICAgICAgZmlsdGVyLiRkb20uYWRkQ2xhc3MoZmlsdGVyLmNsYXNzTmFtZSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYoZmlsdGVyLmF0dHJzKSB7XG4gICAgICAgICAgZmlsdGVyLiRkb20uYXR0cihmaWx0ZXIuYXR0cnMpO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJlZnJlc2hlcyB0aGUgZmlsdGVycyBiYXNlZCBvbiB0aGUgY3VycmVudGx5IGRpc3BsYXllZCBkYXRhIGZvciBlYWNoIGNvbHVtblxuICAgICAqXG4gICAgICogQHJldHVybiB7RmlsdGVyc31cbiAgICAgKi9cbiAgICByZWZyZXNoRmlsdGVyczogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLmZpbHRlcnMuZm9yRWFjaChmdW5jdGlvbiAoZmlsdGVyKSB7XG4gICAgICAgICAgICBmaWx0ZXIucmVmcmVzaCh0aGlzLmdldENvbHVtbkRhdGEoZmlsdGVyLmNvbHVtbikpO1xuICAgICAgICAgICAgdGhpcy5hcHBseUZpbHRlcihmaWx0ZXIpO1xuICAgICAgICB9LCB0aGlzKTtcblxuICAgICAgICB0aGlzLmRyYXdUYWJsZSgpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbn0pO1xuXG4kKGRvY3VtZW50KS5vbigncHJlSW5pdC5kdCcsIGZ1bmN0aW9uIChlLCBzZXR0aW5ncykge1xuICAgIG5ldyBGaWx0ZXJzKHNldHRpbmdzKTtcbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEZpbHRlcnM7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJyQnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJyQnXSA6IG51bGwpO1xudmFyIEJhc2VGaWx0ZXIgPSByZXF1aXJlKCcuLi9iYXNlZmlsdGVyJyk7XG52YXIgU2ltcGxlUmVuZGVyZXIgPSByZXF1aXJlKCcuLi9yZW5kZXJlci9zaW1wbGUnKTtcbnZhciBGaWx0ZXJzID0gcmVxdWlyZSgnLi4vZmlsdGVycycpO1xuXG52YXIgSW5wdXRGaWx0ZXIgPSAkLmV4dGVuZCh7fSwgQmFzZUZpbHRlciwgU2ltcGxlUmVuZGVyZXIsIHtcblxuICAgIGluaXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy4kZG9tID0gJCgnPGlucHV0IGNsYXNzPVwiZmlsdHJlXCIvPicpO1xuICAgICAgICB0aGlzLiRkb20ub24oJ2lucHV0JywgdGhpcy5ub3RpZnlDaGFuZ2UuYmluZCh0aGlzKSk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIHBvcHVsYXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICB1cGRhdGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIG5vU2VsZWN0aW9uUXVlcnk6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuICcnO1xuICAgIH0sXG5cbiAgICBpc1JlZ2V4TWF0Y2g6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSxcblxuICAgIGhhc1ZhbHVlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLiRkb20udmFsKCkgIT0gJyc7XG4gICAgfSxcblxuICAgIHNlbGVjdGVkUXVlcnk6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuJGRvbS52YWwoKTtcbiAgICB9LFxuXG4gICAgZ2V0SW5pdGlhbFF1ZXJ5OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiAnJztcbiAgICB9XG59KTtcblxuRmlsdGVycy5wcm90b3R5cGUuYnVpbGRlcnMuaW5wdXQgPSBmdW5jdGlvbihzZXR0aW5ncykge1xuICByZXR1cm4gJC5leHRlbmQoe30sIElucHV0RmlsdGVyLCBzZXR0aW5ncyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IElucHV0RmlsdGVyOyIsIid1c2Ugc3RyaWN0JztcblxucmVxdWlyZSgnLi9zZWxlY3Qvc2ltcGxlc2VsZWN0Jyk7XG5yZXF1aXJlKCcuL3NlbGVjdC9tdWx0aXNlbGVjdCcpO1xucmVxdWlyZSgnLi9zZWxlY3QvZml4ZWRzZWxlY3QnKTtcbnJlcXVpcmUoJy4vaW5wdXQvaW5wdXQnKTtcbnJlcXVpcmUoJy4vZmlsdGVycycpOyIsIid1c2Ugc3RyaWN0JztcblxudmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snJCddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnJCddIDogbnVsbCk7XG5cbnZhciBTaW1wbGVSZW5kZXJlciA9IHtcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgkY29udGFpbmVyLCBoZWFkZXIsIGRhdGEpIHtcbiAgICAgICAgdGhpcy5wb3B1bGF0ZShkYXRhKTtcbiAgICAgICAgdGhpcy5zaG93RmlsdGVyKHRoaXMuJGRvbSwgJGNvbnRhaW5lciwgaGVhZGVyLCBkYXRhKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgc2hvd0ZpbHRlcjogZnVuY3Rpb24oJGRvbSwgJGNvbnRhaW5lciwgaGVhZGVyLCBkYXRhKSB7XG4gICAgICAgICRjb250YWluZXIuYXBwZW5kKHRoaXMuJGRvbSk7XG4gICAgICAgIHRoaXMuJGRvbS5hdHRyKCduYW1lJywgaGVhZGVyKS5hdHRyKCdwbGFjZWhvbGRlcicsIGhlYWRlcikuc2hvdygpO1xuICAgIH0sXG5cbiAgICByZWZyZXNoOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICB0aGlzLnVwZGF0ZShkYXRhKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNpbXBsZVJlbmRlcmVyOyIsIid1c2Ugc3RyaWN0JztcblxudmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snJCddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnJCddIDogbnVsbCk7XG52YXIgQmFzZUZpbHRlciA9IHJlcXVpcmUoJy4uL2Jhc2VmaWx0ZXInKTtcbnZhciBTaW1wbGVSZW5kZXJlciA9IHJlcXVpcmUoJy4uL3JlbmRlcmVyL3NpbXBsZScpO1xudmFyIEJvb3RzdHJhcFJlbmRlcmVyID0gcmVxdWlyZSgnLi9yZW5kZXJlci9ib290c3RyYXAnKTtcblxuLyoqXG4gKiBTZWxlY3RGaWx0ZXIgcmVncm91cHMgY29tbW9uIGJlaGF2aW9yIGZvciBzZWxlY3QgZmlsdGVyc1xuICovXG52YXIgU2VsZWN0RmlsdGVyID0gJC5leHRlbmQoe30sIEJhc2VGaWx0ZXIsIHtcbiAgICBzZWxlY3RlZDogW10sXG5cbiAgICAvKipcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIGFuIGFsd2F5cyBmYWxzZSByZWdleCB0byBoaWRlIGV2ZXJ5IHJlY29yZHNcbiAgICAgKiB3aGVuIG5vIG9wdGlvbiBpcyBzZWxlY3RlZFxuICAgICAqL1xuICAgIG5vU2VsZWN0aW9uUXVlcnk6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuICckLl4nO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZS4gU2VsZWN0IGZpbHRlcnMgYWx3YXlzIHVzZSByZWdleFxuICAgICAqL1xuICAgIGlzUmVnZXhNYXRjaDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgdHJ1ZSBpZiBhdCBsZWFzdCBvbmUgb3B0aW9uIGlzIHNlbGVjdGVkXG4gICAgICovXG4gICAgaGFzVmFsdWU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2dldFNlbGVjdGlvbigpLmxlbmd0aCA+IDA7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBjb2x1bW4gZmlsdGVyIHF1ZXJ5IHRvIGFwcGx5LiBTZWxlY3RlZCBvcHRpb24gdmFsdWVzXG4gICAgICogYXJlIGNvbmNhdGVuYXRlZCBpbnRvIGEgc3RyaW5nIHVzaW5nIHRoZSBwaXBlIGNoYXJhY3RlciAocmVnZXggb3IpXG4gICAgICovXG4gICAgc2VsZWN0ZWRRdWVyeTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZ2V0U2VsZWN0aW9uKCkubWFwKGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgaWYgKHZhbHVlID09IHRoaXMuYWxsVGV4dCAgfHwgdGhpcy5fZ2V0Tm90U2VsZWN0ZWQoKS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJyc7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiAnXicgKyAkLmZuLmRhdGFUYWJsZS51dGlsLmVzY2FwZVJlZ2V4KHZhbHVlKSArICckJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgdGhpcykuam9pbignfCcpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBGaWx0ZXJzIHRoZSBvcHRpb25zIGJlZm9yZSBhZGRpbmcgdGhlbSB0byB0aGUgc2VsZWN0LiBDYW4gYmUgb3ZlcnJpZGRlblxuICAgICAqIGZvciBzcGVjaWZpYyBmaWx0ZXJpbmdcbiAgICAgKlxuICAgICAqIEBwYXJhbSB2YWx1ZSB7U3RyaW5nfSBPcHRpb24gdmFsdWVcbiAgICAgKi9cbiAgICBmaWx0ZXJPcHRpb25zOiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlLnRyaW0oKSAhPSAnJztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU29ydCB0aGUgb3B0aW9ucyBiZWZvcmUgYWRkaW5nIHRoZW0gdG8gdGhlIHNlbGVjdC4gQ2FuIGJlIG92ZXJyaWRkZW4gZm9yXG4gICAgICogc3BlY2lmaWMgc29ydHNcbiAgICAgKi9cbiAgICBzb3J0T3B0aW9uczogZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgaWYgKGEgPiBiKSB7XG4gICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhIDwgYikge1xuICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEByZXR1cm5zIHtBcnJheTxTdHJpbmc+fSBUaGUgYXJyYXkgb2Ygc2VsZWN0ZWQgdmFsdWVzXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZ2V0U2VsZWN0aW9uOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLiRkb20uZmluZCgnb3B0aW9uOnNlbGVjdGVkJykudG9BcnJheSgpLm1hcChmdW5jdGlvbihvcHRpb24pIHtcbiAgICAgICAgICAgIHJldHVybiBvcHRpb24udmFsdWU7XG4gICAgICAgIH0pO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHsqfEFycmF5fSBUaGUgYXJyYXkgb2Ygbm9uIHNlbGVjdGVkIHZhbHVlc1xuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2dldE5vdFNlbGVjdGVkOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuJGRvbS5maW5kKCc6bm90KG9wdGlvbjpzZWxlY3RlZCknKS50b0FycmF5KCkubWFwKGZ1bmN0aW9uKG9wdGlvbikge1xuICAgICAgICAgICAgcmV0dXJuIG9wdGlvbi52YWx1ZTtcbiAgICAgICAgfSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEZvciBlYWNoIGVsZW1lbnQgaW4gdGhlIGRhdGEgb2JqZWN0LCBjcmVhdGVzIGFuIG9wdGlvbiBlbGVtZW50IHVzaW5nIHRoZSBmdW5jdGlvblxuICAgICAqIGZuQ3JlYXRlXG4gICAgICpcbiAgICAgKiBAcGFyYW0gZGF0YSB7alF1ZXJ5fSBUaGUgZGF0YSB0byBhZGQgdG8gdGhlIHNlbGVjdFxuICAgICAqIEBwYXJhbSBmbkNyZWF0ZSB7RnVuY3Rpb259IFRoZSBmdW5jdGlvbiB0byB1c2UgdG8gY3JlYXRlIHRoZSBvcHRpb25zXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfYWRkT3B0aW9uczogZnVuY3Rpb24gKGRhdGEsIGZuQ3JlYXRlKSB7XG4gICAgICAgIHRoaXMuJGRvbS5lbXB0eSgpO1xuXG4gICAgICAgIGlmICh0aGlzLmFsbFRleHQpXG4gICAgICAgICAgICBmbkNyZWF0ZS5jYWxsKHRoaXMsIHRoaXMuYWxsVGV4dCk7XG5cbiAgICAgICAgZGF0YS50b0FycmF5KCkuZmlsdGVyKHRoaXMuZmlsdGVyT3B0aW9ucykuc29ydCh0aGlzLnNvcnRPcHRpb25zKS5mb3JFYWNoKGZuQ3JlYXRlLCB0aGlzKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIHNlbGVjdGVkIG9wdGlvblxuICAgICAqXG4gICAgICogQHBhcmFtIHZhbHVlIHtTdHJpbmd9IFRoZSBvcHRpb24gdmFsdWVcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9hZGRTZWxlY3RlZE9wdGlvbjogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuJGRvbS5hcHBlbmQoJCgnPG9wdGlvbi8+JylcbiAgICAgICAgICAgIC52YWwodmFsdWUpXG4gICAgICAgICAgICAudGV4dCh2YWx1ZSlcbiAgICAgICAgICAgIC5hdHRyKCdzZWxlY3RlZCcsICdzZWxlY3RlZCcpXG4gICAgICAgICk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYW4gb3B0aW9uIHdpdGggdGhlIHNlbGVjdGVkIGZsYWcgYmFzZWQgb24gdGhlXG4gICAgICogY3VycmVudCBmaWx0ZXIgc3RhdGVcbiAgICAgKlxuICAgICAqIEBwYXJhbSB2YWx1ZSB7U3RyaW5nfSBUaGUgb3B0aW9uIHZhbHVlXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcmVmcmVzaE9wdGlvbjogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIHZhciAkb3B0aW9uID0gJCgnPG9wdGlvbi8+JylcbiAgICAgICAgICAgIC52YWwodmFsdWUpXG4gICAgICAgICAgICAudGV4dCh2YWx1ZSk7XG5cbiAgICAgICAgaWYgKCQuaW5BcnJheSh2YWx1ZSwgdGhpcy5zZWxlY3RlZCkgPiAtMSlcbiAgICAgICAgICAgICRvcHRpb24uYXR0cignc2VsZWN0ZWQnLCAnc2VsZWN0ZWQnKTtcblxuICAgICAgICB0aGlzLiRkb20uYXBwZW5kKCRvcHRpb24pO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBUYWtlcyBhIHNuYXBzaG90IG9mIHRoZSBjdXJyZW50IHNlbGVjdGlvbiBzdGF0ZVxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc2F2ZVNlbGVjdGlvbjogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuc2VsZWN0ZWQgPSB0aGlzLl9nZXRTZWxlY3Rpb24oKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogV2hlbmV2ZXIgdGhlIHNlbGVjdCBzdGF0ZSBjaGFuZ2VzLCBzYXZlIGl0cyBuZXcgc3RhdGUgYW5kXG4gICAgICogbm90aWZ5IHRoZSBsaXN0ZW5pbmcgY29tcG9uZW50XG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbkNoYW5nZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuX3NhdmVTZWxlY3Rpb24oKTtcbiAgICAgICAgdGhpcy5ub3RpZnlDaGFuZ2UoKTtcbiAgICB9XG59KTtcblxudmFyIGJ1aWxkZXIgPSBmdW5jdGlvbihzZXR0aW5ncykge1xuICAgIHZhciByZW5kZXJlciA9IFNpbXBsZVJlbmRlcmVyO1xuXG4gICAgaWYgKHNldHRpbmdzLnJlbmRlcmVyID09ICdib290c3RyYXAnKVxuICAgICAgICByZW5kZXJlciA9IEJvb3RzdHJhcFJlbmRlcmVyO1xuXG4gICAgcmV0dXJuICQuZXh0ZW5kKHt9LCB0aGlzLCByZW5kZXJlciwgc2V0dGluZ3MpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgU2VsZWN0RmlsdGVyOiBTZWxlY3RGaWx0ZXIsXG4gICAgYnVpbGRlcjogYnVpbGRlclxufTsiLCIndXNlIHN0cmljdCc7XG5cbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJyQnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJyQnXSA6IG51bGwpO1xudmFyIEZpbHRlcnMgPSByZXF1aXJlKCcuLi9maWx0ZXJzJyk7XG52YXIgQmFzZVNlbGVjdCA9IHJlcXVpcmUoJy4vYmFzZXNlbGVjdCcpO1xuXG52YXIgRml4ZWRTZWxlY3RGaWx0ZXIgPSAkLmV4dGVuZCh7fSwgQmFzZVNlbGVjdC5TZWxlY3RGaWx0ZXIsIHtcblxuICAgIC8qKlxuICAgICAqIFNpbXBseSBzYXZlcyBhIGhhbmRsZSBvbiB0aGUgcHJvdmlkZWQgc291cmNlIHNlbGVjdFxuICAgICAqXG4gICAgICogQHJldHVybnMge0ZpeGVkU2VsZWN0RmlsdGVyfVxuICAgICAqL1xuICAgIGluaXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy4kZG9tID0gJCh0aGlzLnNyYyk7XG4gICAgICAgIHRoaXMuJGRvbS5vbignY2hhbmdlJywgdGhpcy5ub3RpZnlDaGFuZ2UuYmluZCh0aGlzKSk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIE5vIGFjdGlvbiBmb3IgZml4ZWQgZmlsdGVyczogdGhlIHByb3ZpZGVkIHNlbGVjdCBpcyB1c2VkIGFzIGlzXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Rml4ZWRTZWxlY3RGaWx0ZXJ9XG4gICAgICovXG4gICAgcG9wdWxhdGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIE5vIHVwZGF0ZSBmb3IgZml4ZWQgZmlsdGVyczogdGhlIHByb3ZpZGVkIHNlbGVjdCBpcyBuZXZlciBjaGFuZ2VkXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Rml4ZWRTZWxlY3RGaWx0ZXJ9XG4gICAgICovXG4gICAgdXBkYXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBGaXhlZCBmaWx0ZXJzIGNhbiBiZSB1c2VkIHRvIHByb3ZpZGUgaW5pdGlhbCBmaWx0ZXJzIHRvIGFwcGx5IHRvIHRoZVxuICAgICAqIGRhdGF0YWJsZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHsqfFN0cmluZ31cbiAgICAgKi9cbiAgICBnZXRJbml0aWFsUXVlcnk6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRRdWVyeSgpO1xuICAgIH1cbn0pO1xuXG5GaWx0ZXJzLnByb3RvdHlwZS5idWlsZGVycy5maXhlZHNlbGVjdCA9IEJhc2VTZWxlY3QuYnVpbGRlci5iaW5kKEZpeGVkU2VsZWN0RmlsdGVyKTtcblxubW9kdWxlLmV4cG9ydHMgPSBGaXhlZFNlbGVjdEZpbHRlcjsiLCIndXNlIHN0cmljdCc7XG5cbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJyQnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJyQnXSA6IG51bGwpO1xudmFyIEZpbHRlcnMgPSByZXF1aXJlKCcuLi9maWx0ZXJzJyk7XG52YXIgQmFzZVNlbGVjdCA9IHJlcXVpcmUoJy4vYmFzZXNlbGVjdCcpO1xuXG52YXIgTXVsdGlTZWxlY3RGaWx0ZXIgPSAkLmV4dGVuZCh7fSwgQmFzZVNlbGVjdC5TZWxlY3RGaWx0ZXIsIHtcblxuICAgIC8qKlxuICAgICAqIEluaXRpYWxpemVzIGEgbXVsdGlzZWxlY3QgZG9tIG9iamVjdFxuICAgICAqXG4gICAgICogQHJldHVybnMge011bHRpU2VsZWN0RmlsdGVyfVxuICAgICAqL1xuICAgIGluaXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy4kZG9tID0gJCgnPHNlbGVjdCBjbGFzcz1cImZpbHRyZVwiLz4nKS5hdHRyKCdtdWx0aXBsZScsICdtdWx0aXBsZScpO1xuICAgICAgICB0aGlzLiRkb20ub24oJ2NoYW5nZScsIHRoaXMuX29uQ2hhbmdlLmJpbmQodGhpcykpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBQb3B1bGF0ZXMgdGhlIG11bHRpc2VsZWN0IHdpdGggJ3NlbGVjdGVkJyBvcHRpb25zIGJ5IGRlZmF1bHRcbiAgICAgKlxuICAgICAqIEBwYXJhbSBkYXRhXG4gICAgICogQHJldHVybnMge011bHRpU2VsZWN0RmlsdGVyfVxuICAgICAqL1xuICAgIHBvcHVsYXRlOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICB0aGlzLl9hZGRPcHRpb25zKGRhdGEsIHRoaXMuX2FkZFNlbGVjdGVkT3B0aW9uKTtcbiAgICAgICAgdGhpcy5fb25DaGFuZ2UoKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogSWYgdGhlICdhbGwnIG9wdGlvbiBpcyBzZWxlY3RlZCwgc2V0cyB0aGUgbmV3IG9wdGlvbnMgYXMgJ3NlbGVjdGVkJy5cbiAgICAgKiBPdGhlcndpc2UsIGFkZHMgdGhlIG9wdGlvbnMgYmFzZWQgb24gdGhlIGZpbHRlciBzdGF0ZVxuICAgICAqXG4gICAgICogQHBhcmFtIGRhdGFcbiAgICAgKiBAcmV0dXJucyB7TXVsdGlTZWxlY3RGaWx0ZXJ9XG4gICAgICovXG4gICAgdXBkYXRlOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICBpZiAoJC5pbkFycmF5KHRoaXMuYWxsVGV4dCwgdGhpcy5zZWxlY3RlZCkgPiAtMSB8fCB0aGlzLl9nZXROb3RTZWxlY3RlZCgpLmxlbmd0aCA9PSAwKVxuICAgICAgICAgICAgdGhpcy5fYWRkT3B0aW9ucyhkYXRhLCB0aGlzLl9hZGRTZWxlY3RlZE9wdGlvbik7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIHRoaXMuX2FkZE9wdGlvbnMoZGF0YSwgdGhpcy5fcmVmcmVzaE9wdGlvbik7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFRoaXMgZmlsdGVyIGlzIGR5bmFtaWMsIGl0IGNhbid0IGJlIHVzZWQgZm9yIGluaXRpYWwgZmlsdGVyaW5nXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfVxuICAgICAqL1xuICAgIGdldEluaXRpYWxRdWVyeTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAnJztcbiAgICB9XG59KTtcblxuRmlsdGVycy5wcm90b3R5cGUuYnVpbGRlcnMubXVsdGlzZWxlY3QgPSBCYXNlU2VsZWN0LmJ1aWxkZXIuYmluZChNdWx0aVNlbGVjdEZpbHRlcik7XG5cbm1vZHVsZS5leHBvcnRzID0gTXVsdGlTZWxlY3RGaWx0ZXI7IiwiJ3VzZSBzdHJpY3QnO1xudmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snJCddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnJCddIDogbnVsbCk7XG5cbnZhciBCb290c3RyYXBSZW5kZXJlciA9IHtcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgkY29udGFpbmVyLCBoZWFkZXIsIGRhdGEpIHtcbiAgICAgICAgdGhpcy5wb3B1bGF0ZShkYXRhKTtcbiAgICAgICAgdGhpcy5zaG93RmlsdGVyKHRoaXMuJGRvbSwgJGNvbnRhaW5lciwgaGVhZGVyLCBkYXRhKTtcblxuICAgICAgICB2YXIgZGVmYXVsdE9wdGlvbnMgPSB7XG4gICAgICAgICAgICBidXR0b25UZXh0OiBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICAgICAgICAgIHZhciBuYlNlbGVjdGVkID0gJChvcHRpb25zKS5maWx0ZXIoJzpzZWxlY3RlZCcpLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBpZihuYlNlbGVjdGVkID09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGhlYWRlcjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIGhlYWRlciArICcgKCcgKyBuYlNlbGVjdGVkICsgJyknO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuJGRvbS5tdWx0aXNlbGVjdCgkLmV4dGVuZChkZWZhdWx0T3B0aW9ucywgdGhpcy5yZW5kZXJlck9wdGlvbnMpKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgc2VsZWN0ZWRRdWVyeTogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgJHdpZGdldCA9IHRoaXMuJGRvbS5tdWx0aXNlbGVjdCgpO1xuXG4gICAgICAgIGlmICgkLmluQXJyYXkoJHdpZGdldC5zZWxlY3RBbGxUZXh0LCAkd2lkZ2V0LnZhbCgpKSkge1xuICAgICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2dldFNlbGVjdGlvbigpLm1hcChmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgICAgICBpZiAodmFsdWUgPT0gdGhpcy5hbGxUZXh0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ14nICsgJC5mbi5kYXRhVGFibGUudXRpbC5lc2NhcGVSZWdleCh2YWx1ZSkgKyAnJCc7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSwgdGhpcykuam9pbignfCcpO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIHNob3dGaWx0ZXI6IGZ1bmN0aW9uKCRkb20sICRjb250YWluZXIsIGhlYWRlciwgZGF0YSkge1xuICAgICAgICAkY29udGFpbmVyLmFwcGVuZCh0aGlzLiRkb20pO1xuICAgIH0sXG5cbiAgICByZWZyZXNoOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICB0aGlzLnVwZGF0ZShkYXRhKTtcbiAgICAgICAgdGhpcy4kZG9tLm11bHRpc2VsZWN0KCdyZWJ1aWxkJyk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBCb290c3RyYXBSZW5kZXJlcjsiLCIndXNlIHN0cmljdCc7XG5cbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJyQnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJyQnXSA6IG51bGwpO1xudmFyIEZpbHRlcnMgPSByZXF1aXJlKCcuLi9maWx0ZXJzJyk7XG52YXIgQmFzZVNlbGVjdCA9IHJlcXVpcmUoJy4vYmFzZXNlbGVjdCcpO1xuXG52YXIgU2ltcGxlU2VsZWN0RmlsdGVyID0gJC5leHRlbmQoe30sIEJhc2VTZWxlY3QuU2VsZWN0RmlsdGVyLCB7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgc2ltcGxlIHNlbGVjdFxuICAgICAqXG4gICAgICogQHJldHVybnMge1NpbXBsZVNlbGVjdEZpbHRlcn1cbiAgICAgKi9cbiAgICBpbml0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuJGRvbSA9ICQoJzxzZWxlY3QgY2xhc3M9XCJmaWx0cmVcIi8+Jyk7XG4gICAgICAgIHRoaXMuJGRvbS5vbignY2hhbmdlJywgdGhpcy5fb25DaGFuZ2UuYmluZCh0aGlzKSk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEFkZHMgYWxsIG9wdGlvbnMgd2l0aG91dCBzcGVjaWZ5aW5nIHRoZSAnc2VsZWN0ZWQnIGZsYWdcbiAgICAgKiAodGhlIGZpcnN0IG9wdGlvbiBpcyBzZWxlY3RlZCBieSBkZWZhdWx0KVxuICAgICAqXG4gICAgICogQHBhcmFtIGRhdGFcbiAgICAgKiBAcmV0dXJucyB7U2ltcGxlU2VsZWN0RmlsdGVyfVxuICAgICAqL1xuICAgIHBvcHVsYXRlOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICB0aGlzLl9hZGRPcHRpb25zKGRhdGEsIHRoaXMuX3JlZnJlc2hPcHRpb24pO1xuICAgICAgICB0aGlzLl9vbkNoYW5nZSgpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZWZyZXNoIHRoZSBvcHRpb25zIGJhc2VkIG9uIHRoZSBmaWx0ZXIgc3RhdGVcbiAgICAgKlxuICAgICAqIEBwYXJhbSBkYXRhXG4gICAgICogQHJldHVybnMge1NpbXBsZVNlbGVjdEZpbHRlcn1cbiAgICAgKi9cbiAgICB1cGRhdGU6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgIHRoaXMuX2FkZE9wdGlvbnMoZGF0YSwgdGhpcy5fcmVmcmVzaE9wdGlvbik7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFRoaXMgZmlsdGVyIGlzIGR5bmFtaWMsIGl0IGNhbid0IGJlIHVzZWQgZm9yIGluaXRpYWwgZmlsdGVyaW5nXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfVxuICAgICAqL1xuICAgIGdldEluaXRpYWxRdWVyeTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAnJztcbiAgICB9XG59KTtcblxuRmlsdGVycy5wcm90b3R5cGUuYnVpbGRlcnMuc2VsZWN0ID0gQmFzZVNlbGVjdC5idWlsZGVyLmJpbmQoU2ltcGxlU2VsZWN0RmlsdGVyKTtcblxubW9kdWxlLmV4cG9ydHMgPSBTaW1wbGVTZWxlY3RGaWx0ZXI7Il19
