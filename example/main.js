$(document).ready(function () {
        var table = $('#exampleTable').DataTable({
            ajax: {
                url: "./data.json"
            },
            sAjaxDataProp: '',
            columns: [
                {
                    data: 'email',
                    filter: {
                        type: 'select',
                        renderer: 'bootstrap',
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
                        renderer: 'bootstrap',
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
    }
);