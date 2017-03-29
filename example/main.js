$(document).ready(function () {
        var table = $('#exampleTable').DataTable({
            filters: {
                updater: 'others'
            },
            ajax: {
                url: "./data.json"
            },
            sAjaxDataProp: '',
            columns: [
                {
                    data: 'email',
                    filter: {
                        type: 'select',
                        allText: 'All emails'
                    }
                },
                {
                    data: 'name',
                    visible: false,
                    filter: {
                        type: 'input'
                    }
                },
                {
                    data: 'gender',
                    filter: {
                        type: 'multiselect',
                        renderer: 'bootstrap',
                        getInitialQuery: function () {
                            return 'male';
                        },
                        rendererOptions: {
                          selectAllText: 'All',
                          includeSelectAllOption: true
                        },
                        filterOptions: function (option) {
                            return option != 'N/A';
                        }
                    }
                },
                {
                    data: 'company',
                    filter: {
                        type: 'multiselect',
                        showFilter: function ($dom) {
                            $('#cityFilter').append($dom);
                        }
                    }
                }
            ]
        });

        $('#reloadAjax').click(function () {
            table.ajax.url('./data2.json').ajax.reload();
        });

        $(".toggleColumn").click(function () {
            var columnIndex = $(this).attr('data-column');
            table.column(columnIndex).visible(!table.column(columnIndex).visible());
        });

        $("#showHideDT").click(function () {
            $("#exampleTableContent").toggle();
        });
    }
);
