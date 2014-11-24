/*jslint node:true */
/*global $,c3,pathname,superagent */
$(document).ready(function () {
  'use strict';
  var table;
  var dtFacets = {};
  var fieldNb;
  var filter= {};
  var request = superagent;
  var self = this;

  var isOnlyChart = function isOnlyChart(id) {
    return pathname === '/chart.html' &&
           typeof params !== 'undefined' &&
           params.id === id;
  };

  var bootstrapPosition = function(id, size) {
    if (isOnlyChart(id)) {
      return;
    }
    if (size.columns) {
      $('#' + id)
      .parent()
      .removeClass("col-md-12")
      .addClass("col-md-" + size.columns);
    }
    if (size.offset) {
      $('#' + id)
      .parent()
      .addClass("col-md-offset-" + size.offset);
    }
  };

  var displayFilter = function displayFilter() {
    var filterVerbalized = '';
    console.log('filter.main', filter.main);
    if (filter.main) {
      filterVerbalized = '<strong>' + filter.main + '</strong>';
      $('#filter').html(filterVerbalized);
    }
    Object.keys(filter, function (label, value) {
      if (label === 'main') { return; }
      filterVerbalized = filterVerbalized + ' ' + label + '=' +
                         '<strong>' + value + '</strong>';
    });
    $('#filter').html(filterVerbalized);
  };

  var generateHistogram = function(id, pref) {
    if (pref.title) {
      $('#' + id).before('<div class="panel-heading">' +
                         '<h2 class="panel-title">' +
                         pref.title +
                         '</h2></div>');
    }

    request
    .get('/compute.json?o=distinct&f=' + pref.field + '&itemsPerPage=100')
    .end(function(res) {
      self.years = res.body.data;

      // Create a dictionary: year -> occurrence
      var y = {};
      self.years.each(function(e) {
        y[e._id] = e.value;
      });

      var categories = Object.keys(y);
      var columns = Object.values(y);
      columns.unshift('notices'); // TODO make it configurable?

      // Default options values
      var options = {
        bindto: '#' + id,
        data: {
          columns: [
            columns
          ],
          types: { notices: 'bar'}
        },
        axis: {
          x: {
            type: 'category',
            categories: categories
          }
        },
        size: {
          height: 'auto'
        }
      };
      // Override options with configuration values
      if (pref.size) {
        options.size = pref.size;
        bootstrapPosition(id, pref.size);
      }
      // Color
      if (pref.color) {
        options.data.colors = { notices : pref.color };
      }
      // Legend
      options.legend = pref.legend || { show: false };

      if (isOnlyChart(id)) {
        options.data.selection = { enabled : true };
        options.data.selection.multiple = false;
        options.data.onselected = function (d, element) {
          var filterValue = categories[d.index];
          // Update documents
          table.columns(0).search(filterValue).draw();
          // Update facets
          if (pref.facets) {
            Object.keys(pref.facets, function updateFacet(facetId, facet) {
              var url = '/compute.json?o=distinct&f=' + facet.path +
                        '&columns[2][data]='          + pref.field +
                        '&columns[2][search][value]=' + filterValue;
              dtFacets[facetId].ajax.url(url);
              dtFacets[facetId].ajax.reload();
            });
          }
          filter.main = filterValue;
          displayFilter(filterValue);
        };
      }

      var histogram = c3.generate(options);
    });
  };

  var generatePie = function(id, pref) {
    if (pref.title) {
      $('#' + id)
      .before('<div class="panel-heading">' +
              '<h2 class="panel-title">' +
              pref.title +
              '</h2></div>');
    }

    request
    .get('/compute.json?o=distinct&f=' + pref.field + '&itemsPerPage=100')
    .end(function(res) {
      self.themes = res.body.data;

      var columns = [];
      self.themes.each(function(e) {
        columns.push([e._id, e.value]);
      });

      // Default options values
      var options = {
        bindto: '#' + id,
        data: {
          columns: columns,
          type: 'pie'
        },
        pie: {
          label: {
            format: function (v, r) { return String(v); }
          }
        },
        legend: {
          position: 'right'
        },
        size: {
          height: "auto"
        },
        tooltip: {
          format: {
            value: function (value, ratio, id) {
              return value;
            }
          }
        }
      };
      // Override options with configuration values
      if (pref.legend) {
        options.legend = pref.legend;
      }
      if (pref.size) {
        options.size = pref.size;
        bootstrapPosition(id, pref.size);
      }
      var colors        = {};
      var i             = 0;
      var orderedValues = {};
      // Colors
      if (pref.colors) {
        // Reorder by values
        columns.each(function (e) {
          orderedValues[e[1]] = e[0];
        });
        Object.keys(orderedValues, function (value, key) {
          colors[key] = pref.colors[i++ % pref.colors.length];
        });
        options.data.colors = colors;
      }
      else if (!options.data.colors) {
        // Default colors pattern
        var defaultColors =
          [ '#BB9FF5', '#ff7a85', '#44b2ba', '#ffa65a', '#34cdb8'];
        // Reorder by values
        columns.each(function (e) {
          orderedValues[e[1]] = e[0];
        });
        Object.keys(orderedValues, function (value, key) {
          colors[key] = defaultColors[i++ % defaultColors.length];
        });
        options.data.colors = colors;
      }

      if (isOnlyChart(id)) {
        options.data.selection          = {enabled:true};
        options.data.selection.multiple = false;
        options.data.onselected = function (d, element) {
          var filterValue = d.id;
          table.columns(0).search(filterValue).draw();
          // Update facets
          if (pref.facets) {
            Object.keys(pref.facets, function updateFacet(facetId, facet) {
              var url = '/compute.json?o=distinct&f=' + facet.path +
                        '&columns[2][data]='          + pref.field +
                        '&columns[2][search][value]=' + filterValue;
              dtFacets[facetId].ajax.url(url);
              dtFacets[facetId].ajax.reload();
            });
          }
          filter.main = filterValue;
          displayFilter(filterValue);
        };
      }

      // Generate the pie.
      var pie = c3.generate(options);
    });
  };

  var generateHorizontalBars = function(id, pref) {
    if (pref.title) {
      $('#' + id)
      .before('<div class="panel-heading">' +
        '<h2 class="panel-title">' +
        pref.title +
        '</h2></div>');
    }

    request
    .get('/compute.json?o=distinct&f=' + pref.field + '&itemsPerPage=100' +
         '&columns[0][data]=value&columns[0][orderable]=true' +
         '&order[0][column]=0&order[0][dir]=desc')
    .end(function(res) {
      var keys = res.body.data;

      // Create a dictionary: key -> occurrence
      var k = {};
      keys.each(function(e) {
        k[e._id] = e.value;
      });

      var categories = Object.keys(k);
      var columns = Object.values(k);
      columns.unshift('notices'); // TODO make it configurable?

      // Default options values
      var options = {
        bindto: '#' + id,
        data: {
          columns: [
            columns
          ],
          types: { notices: 'bar'}
        },
        axis: {
          rotated: true,
          x: {
            type: 'category',
            categories: categories
          }
        },
        size: {
          height: 'auto'
        }
      };
      // Override options with configuration values
      if (pref.size) {
        options.size = pref.size;
        bootstrapPosition(id, pref.size);
      }
      // Color
      if (pref.color) {
        options.data.colors = { notices : pref.color };
      }
      if (pref.legend) {
        options.legend = pref.legend;
      }

      if (isOnlyChart(id)) {
        // TODO: maximize height
        options.data.selection = {enabled:true};
        options.data.selection.multiple = false;
        options.data.onselected = function (d, element) {
          var filterValue = categories[d.index];
          table.columns(0).search(filterValue).draw();
          // Update facets
          if (pref.facets) {
            Object.keys(pref.facets, function updateFacet(facetId, facet) {
              var url = '/compute.json?o=distinct&f=' + facet.path +
                        '&columns[2][data]='          + pref.field +
                        '&columns[2][search][value]=' + filterValue;
              dtFacets[facetId].ajax.url(url);
              dtFacets[facetId].ajax.reload();
            });
          }
          filter.main = filterValue;
          displayFilter(filterValue);
        };
      }

      var histogram = c3.generate(options);
    });
  };

  /**
   * Create the facets of the graph id
   * @param  {String} id     Identifier of the graph
   * @param  {Array}  facets Facets to draw for the graph
   */
  var createFacets = function createFacets(id, facets) {
    if (!facets) {
      $('#charts').removeClass('col-md-9').addClass('col-md-12');
      $('#facetsTabs').addClass('hidden');
      return;
    }
    var facetNb = 0;
    facets.forEach(function (facet, facetId) {
      // Tabs
      $('#facets')
      .append(
        '<li id="facet-' + facetId + '" class="facetLi" role="presentation">' +
        ' <a href="#tabFacet-' + facetId +'">' + facet.label + '</a>' +
        '</li>');

      // Tables
      $('#facets')
      .after(
        '<table ' +
        '  class="table table-striped table-bordered table-hover"' +
        '  id="dtFacets-' + facetId + '">' +
        '  <thead>' +
        '  <tr>' +
        '    <th>' + facet.label + '</th>' +
        '    <th>Occ</th>' +
        '  </tr>' +
        '  </thead>' +
        '</table>');

      var dtFacet = $('#dtFacets-' + facetId).DataTable({
        ajax: '/compute.json?o=distinct&f=' + facet.path,
        serverSide: true,
        dom: "rtip",
        pagingType: "simple",
        columns: [
          { "data": "_id" },
          { "data": "value" }
        ],
        "order": [[1, "desc"]]
      });
      dtFacets[facetId] = dtFacet; // for later reference
      if (facetNb) {
        $('#dtFacets-' + facetId + '_wrapper').hide();
      }

      // make tab-nav work
      $('#facet-' + facetId + '>a')
      .click(function (e) {
        e.preventDefault();
        $('#facetsTabs>.dataTables_wrapper').hide();
        $('#dtFacets-'+facetId).parent().show();
        // make the new tab active, and the old one not.
        $('.facetLi').removeClass('active');
        $('#facet-' + facetId).addClass('active');
      });
      if (!facetNb) {
        $('#facet-' + facetId).addClass('active');
      }

      $('#dtFacets-' + facetId + ' tbody').on('click','tr', function selectFacet() {
        // Select only one row
        if ($(this).hasClass('selected')) {
          $(this).removeClass('selected');
        }
        else {
          dtFacet.$('tr.selected').removeClass('selected');
          $(this).addClass('selected');
        }
        var selection = dtFacet.rows('.selected').data();
        var facetIndex = Object.keys(facets).indexOf(facetId);
        if(selection.length) {
          var facetValue = selection[0]._id;
          table.columns(fieldNb + facetIndex).search(facetValue).draw();
          filter[facet.label] = facetValue;
        }
        else {
          table.columns(fieldNb + facetIndex).search('').draw();
          delete filter[facet.label];
        }
        displayFilter();
        // TODO: add this to the filter (and display it), and filter docs
      });
      facetNb ++;
    });
  };

  // Get the dashboard preferences
  request
  .get('/config.json')
  .end(function(res) {
    var config = res.body;
    if (config.dashboard && config.dashboard.charts) {
      self.dashboard = config.dashboard;

      self.dashboard.charts.forEach(function (pref, chartNb) {
        var id = "chart" + chartNb;

        if (isOnlyChart(id) || pathname !== '/chart.html') {

          $('#charts').append('<div class="panel panel-default col-md-12">' +
            '<div id="' +  id + '" class="panel-body"></div>' +
            '</div>');

          if (pref.type && pref.field) {

            if (isOnlyChart(id)) {
              var addLink = function addLink(data, type, row) {
                return '<a href="/display/' + row.wid + '.html">' + data + '</a>';
              };
              var options = {
                search: {
                  regex: true
                },
                ordering: true,
                serverSide: true,
                lengthMenu: [config.itemsPerPage||5,10,25,50,100],
                ajax: "/browse.json",
                dom: "lifrtip"
              };
              var columns = [{
                data: pref.field
              }];
              var facetsNb  = 0;
              var allFields = [];
              fieldNb       = 1;
              for (var userfield in config.documentFields) {
                if (config.documentFields[userfield].visible) {
                  columns.push({data: "fields." + userfield});
                  allFields.push(fieldNb);
                  fieldNb++;
                }
              }
              if (pref.facets) {
                facetsNb = pref.facets.length;
                // Object.keys(pref.facets, function (facetId, facet) {
                pref.facets.forEach(function (facet, facetNb) {
                  var facetId = "facet" + facetNb;
                  columns.push({data: facet.path});
                  $('#dataTables-documents tr')
                  .append('<th>' + facet.label + '</th>');
                });
              }
              options.columns = columns;
              options.columnDefs = [{
                "render": addLink,
                "targets": allFields
              }];
              table = $('#dataTables-documents').DataTable(options);
              table.column(0).visible(false);
              // facets
              for (var i = 0; i < facetsNb; i++) {
                table.column(fieldNb + i).visible(false);
              }
              createFacets(id, pref.facets);
            }


            if (pref.type === 'histogram') {
              generateHistogram(id, pref);
            }
            else if (pref.type === 'horizontalbars') {
              generateHorizontalBars(id, pref);
            }
            else if (pref.type === 'pie') {
              generatePie(id, pref);
            }

            if (!isOnlyChart(id)) {
              $('#' + id).after(
                '<a href="chart.html?id=' + id + '">' +
                '<div class="panel-footer">'+
                '<span class="pull-left">View Details</span>'+
                '<span class="pull-right"><i class="fa fa-arrow-circle-right"></i></span>'+
                '<div class="clearfix"></div>'+
                '</div>' +
                '</a>');
            }
          }
          else {
            console.log('Bad preference for "%s" chart :', id);
            console.log(pref);
          }
        }

      });
    }
    else {
      $('#charts').append('<div  class="alert alert-danger" role="alert">' +
        'No chart configured !' +
        '</div>');
    }
  });

});
