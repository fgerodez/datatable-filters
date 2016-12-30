'use strict';

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
    }
};

module.exports = BaseFilter;