$(document).foundation();

// Override LinkedIn plugin icon style (see also CSS)
if (typeof(IN) !== 'undefined') {
  IN.Event.on(IN, 'systemReady', function() {
    $('.li-connect-mark')
    .addClass('fi-social-linkedin');
  });
}

var resumeApp = angular.module('resumeApp', ['ngSanitize', 'simonengelhardt.scroll-progress-meter', 'angular-loading-bar'])
  .config(function($locationProvider) {
    $locationProvider.html5Mode(true);
  })
  .constant('constants', {
    birthdate: moment(new Date(1980, 6, 24)),
    maxSkillLevel: 6,
    allYears: []
  })
  .config(['constants', function(constants) {
    for(var i = 2001; i <= moment().year(); i++) { // FIXME: Ideally, the initial year would be calculated dynamically from experiences, educations and projects
      constants.allYears.push(i.toString());
    }
  }])
  .config(['cfpLoadingBarProvider', function(cfpLoadingBarProvider) {
    cfpLoadingBarProvider.includeSpinner = false;
  }]);

resumeApp.controller('ExperienceCtrl', ['$scope', 'sheets', 'scroll', 'constants', function ($scope, sheets, scroll, constants) {
  $scope.secondaryExperiencesVisible = false;
  $scope.allYears = constants.allYears;

  sheets.getExperiences().then(function(experiences) {
    var primaryExperiences = [],
        secondaryExperiences = [],
        dateFormat = 'MM/DD/YYYY'; // Date format from Google Sheets API

    angular.forEach(experiences, function(experience) {
      experience.extendedDescriptionVisible = false;
      if (experience.start) experience.start = moment(experience.start, dateFormat);
      if (experience.end) {
        experience.end = moment(experience.end, dateFormat);
      }
      else {
        experience.end = moment();
        experience.current = true;
      }
      if (experience.start && experience.end) {
        experience.duration = moment.duration(experience.end - experience.start);
        if (!experience.secondary) {
          experience.years = [];
          for (var i = experience.start.year(); i <= experience.end.year(); i++) {
            experience.years.push(i.toString());
          }
        }
      }
      if (experience.secondary) {
        experience.dateFormat = 'yyyy';
        secondaryExperiences.push(experience);
      }
      else {
        experience.dateFormat = 'MMMM yyyy';
        primaryExperiences.push(experience);
      }
    });

    $scope.primaryExperiences = primaryExperiences;
    $scope.secondaryExperiences = secondaryExperiences;

    scroll.anchorScrollAfterDigest();
  });
}]);

resumeApp.controller('EducationCtrl', ['$scope', 'sheets', 'scroll', 'constants', function ($scope, sheets, scroll, constants) {
  $scope.allYears = constants.allYears;
  sheets.getEducations().then(function(educations) {
    var dateFormat = 'MM/DD/YYYY'; // Date format from Google Sheets API

    angular.forEach(educations, function(education) {
      if (education.start) education.start = moment(education.start, dateFormat);
      if (education.end) education.end = moment(education.end, dateFormat);
      if (education.start && education.end && !education.secondary) {
        education.years = [];
        for (var i = education.start.year(); i <= education.end.year(); i++) {
          education.years.push(i.toString());
        }
      }
    });

    $scope.educations = educations;

    scroll.anchorScrollAfterDigest();
  });
}]);

resumeApp.controller('ProjectsCtrl', ['$scope', 'sheets', 'constants', 'scroll', 'util', function ($scope, sheets, constants, scroll, util) {
  var unfilteredRole = 'All';
  $scope.roles = [];
  $scope.selectedRole = unfilteredRole;
  $scope.allYears = constants.allYears;
  $scope.selectedSkill = undefined;
  $scope.maxSkillLevel = constants.maxSkillLevel;
  $scope.removeWhiteSpace = util.removeWhiteSpace;

  sheets.getProjects().then(function(projects){
    $scope.projects = projects;
    angular.forEach($scope.projects, function(project){
      project.extendedDescriptionVisible = false;
      angular.forEach(project.roles, function(role){
        if ($scope.roles.indexOf(role) === -1)
          $scope.roles.push(role);
      });
      if (angular.isArray(project.techs) && angular.isArray(project.services)) project.techAndServices = project.techs.concat(project.services);
      else if (angular.isArray(project.techs)) project.techAndServices = project.techs;
      else if (angular.isArray(project.services)) project.techAndServices = project.services;
    });
    $scope.roles.sort();
    $scope.roles.unshift(unfilteredRole);

    scroll.anchorScrollAfterDigest();
  });

  sheets.getSkills().then(function(skills) {
    $scope.skillHasDescription = function(name) {
      return skills.some(function(skill) {
        return skill.name === name;
      });
    };

    $scope.selectSkill = function(name) {
      $scope.selectedSkill = skills.filter(function(skill) {
        return skill.name === name;
      })[0];
    };
  });

  $scope.roleFilter = function(project){
    return $scope.selectedRole === unfilteredRole || angular.isArray(project.roles) && project.roles.indexOf($scope.selectedRole) !== -1;
  };

  $scope.sortNumbersDesc = function(a, b) {
    return b - a;
  };
}]);

resumeApp.controller('InfoCtrl', ['$scope', 'constants', function($scope, constants) {
  $scope.birthdate = constants.birthdate;
  $scope.age = moment().diff($scope.birthdate, 'years');
}]);

resumeApp.controller('SkillsCtrl', ['$scope', 'sheets', 'constants', 'scroll', 'util', '$location', function($scope, sheets, constants, scroll, util, $location) {
  $scope.removeWhiteSpace = util.removeWhiteSpace;
  $scope.maxSkillLevel = constants.maxSkillLevel;
  $scope.highlight = $location.search().highlight;

  sheets.getSkills()
    .then(function(skills) {
      $scope.categories = _.groupBy(skills, 'category');
      scroll.anchorScrollAfterDigest();
    });
}]);

resumeApp.factory('sheets', ['$http', '$location', function($http, $location) {
  // Simple mapping of all properties from Google spreadsheet columns
  function mapSheet(data) {
    const [keys, ...values] = data.values;

    const objects = values.map(value => Object.fromEntries(value.map((v, i) => [keys[i].toLowerCase(), v])));

    return objects;
  }

  function getSheet(sheet) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/1PtKGUKUg3-9EQxkg4oVuZhPv90v82yIkw0ng-NfGedk/values/${sheet}?key=AIzaSyDamO9s2ehd1rqiMa2hRaAzEauICbXPZ08`
    return $http.get(url)
      .then(function(response) {
        return mapSheet(response.data);
      });
  }

  return {
    getProjects: function() {
      return getSheet('Projects');
    },
    getEducations: function() {
      return getSheet('Education');
    },
    getExperiences: function() {
      return getSheet('Experience');
    },
    getSkills: function() {
      return getSheet('Skills');
    }
  };
}]);

resumeApp.factory('scroll', ['$location', '$timeout', '$anchorScroll', function($location, $timeout, $anchorScroll) {
  return {
    anchorScrollAfterDigest: function() {

      // Only scroll if location contains an anchor hash
      if ($location.hash().length > 0) {

        // Queue a scroll to anchor after the digest cycle
        $timeout(function() {
          $anchorScroll();
        });
      }
    }
  };
}]);

resumeApp.factory('util', [function() {
  return {
    removeWhiteSpace: function(str) {
      return angular.isString(str) ? str.replace(/\s/g, '') : str;
    }
  };
}]);

// This directive will trigger a scroll event on the window when the element is clicked
resumeApp.directive('triggerScrollOnclick', ['$timeout', '$window', function($timeout, $window) {
  return function(scope, element, attr) {
    element.on('click', function() {

      // defer until digest cycle is complete
      $timeout(function() {

        // trigger scroll event on the window
        $window.dispatchEvent(new Event('scroll'));
      });
    });
  };
}]);

// Directive to close all existing dropdowns.
// Workaround for Foundation dropdowns not functioning too well when reusing popup element for several targets.
resumeApp.directive('dropdownCloser', ['$document', function ($document) {
  return function(scope, element, attr) {
    element.on('mousedown', function(event) {
      $document.foundation('dropdown', 'closeall');
    });
  };
}]);

resumeApp.directive('odometer', function () {
  return {
    restrict: 'E',
    scope : {
      endValue : '=value'
    },
    link: function(scope, element, attr) {
      var od = new Odometer({
          el : element[0],
          value : 0,   // default value
          duration: 300
      });

      scope.$watch('endValue', function() {
        od.update(scope.endValue);
      });
    }
  };
});

resumeApp.directive('bindWidth', ['constants', '$timeout', function (constants, $timeout) {
  return {
    restrict: 'A',
    scope : {
      level: '=bindWidth'
    },
    link: function(scope, element, attr) {
      scope.$watch('level', function() {

        // Wait until after digest to set width, so the transition will be animated
        $timeout(function() {
          element.css('width', scope.level / constants.maxSkillLevel * 100 + '%');
        });
      });
    }
  };
}]);
