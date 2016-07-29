'use strict';

angular.module('singleConceptAuthoringApp')
  .service('componentAuthoringUtil', function (metadataService) {

    /////////////////////////////////////
    // calls to return JSON objects
    /////////////////////////////////////

    function getNewAcceptabilityMap(moduleId, defaultValue, initial) {
      var acceptabilityMap = {};
      var dialects = metadataService.getDialectsForModuleId(moduleId);
      for (var key in dialects) {

        // different behavior between extension and international content
        if (metadataService.isExtensionSet() && !initial) {
          // if this key is the default language, set acceptability to preferred
          if (dialects[key] === metadataService.getDefaultLanguageForModuleId(moduleId)) {
            acceptabilityMap[key] = 'PREFERRED';
          }
        }
        else if(initial && dialects[key] === metadataService.getDefaultLanguageForModuleId(moduleId)){
            
        }else {
          acceptabilityMap[key] = defaultValue ? defaultValue : 'ACCEPTABLE';
        }




      }
      return acceptabilityMap;
    }

    function getNewDescription(moduleId) {
      if (!moduleId) {
        moduleId = metadataService.getCurrentModuleId();
      }
      return {
        'active': true,
        'moduleId': moduleId,
        'type': 'SYNONYM',
        'term': null,
        'lang': metadataService.getDefaultLanguageForModuleId(moduleId),
        'caseSignificance': 'INITIAL_CHARACTER_CASE_INSENSITIVE',
        'conceptId': null,
        'acceptabilityMap': getNewAcceptabilityMap(moduleId, 'ACCEPTABLE')
      };
    }

    function getNewFsn(moduleId, initial) {
      // add FSN acceptability and type
      var desc = getNewDescription(moduleId);
      desc.type = 'FSN';
      desc.acceptabilityMap = getNewAcceptabilityMap(moduleId, 'PREFERRED', initial);
      

      return desc;
    }

    function getNewPt(moduleId, initial) {
      // add PT acceptability and type
      var desc = getNewDescription(moduleId);
      desc.type = 'SYNONYM';
      desc.acceptabilityMap = getNewAcceptabilityMap(moduleId, 'PREFERRED', initial);
      return desc;
    }

    function getNewTextDefinition(moduleId) {
      // add PT acceptability and type
      var desc = getNewDescription(moduleId);
      desc.type = 'TEXT_DEFINITION';
      desc.caseSignificance = 'ENTIRE_TERM_CASE_SENSITIVE';
      desc.acceptabilityMap = getNewAcceptabilityMap(moduleId, 'PREFERRED');

      return desc;
    }

    // creates a blank relationship linked to specified source concept
    function getNewIsaRelationship(moduleId) {
      if (!moduleId) {
        moduleId = metadataService.getCurrentModuleId();
      }
      return {
        'active': true,
        'characteristicType': 'STATED_RELATIONSHIP',
        'effectiveTime': null,
        'groupId': 0,
        'modifier': 'EXISTENTIAL',
        'moduleId': moduleId,
        'target': {
          'conceptId': null
        },
        'type': {
          'conceptId': '116680003',
          'fsn': 'Is a (attribute)'
        }
      };
    }

    // creates a blank relationship linked to specified source concept
    function getNewAttributeRelationship(moduleId) {
      if (!moduleId) {
        moduleId = metadataService.getCurrentModuleId();
      }
      return {
        'active': true,
        'characteristicType': 'STATED_RELATIONSHIP',

        'effectiveTime': null,
        'groupId': 0,
        'modifier': 'EXISTENTIAL',
        'moduleId': moduleId,
        'target': {
          'conceptId': null
        },
        'type': {
          'conceptId': null
        }
      };
    }

    // creats a blank concept with one each of a blank
    // description, relationship, attribute
    function getNewConcept() {
      var moduleId = metadataService.getCurrentModuleId();
      var concept = {
        'conceptId': null,
        'descriptions': [],
        'relationships': [],
        'fsn': null,
        'definitionStatus': 'PRIMITIVE',
        'active': true,
        'released' : false,
        'moduleId': moduleId
      };

      // add FSN description
      concept.descriptions.push(getNewFsn(moduleId, true));

      // add a Preferred Term
      concept.descriptions.push(getNewPt(moduleId, true));

      // add IsA relationship
      concept.relationships.push(getNewIsaRelationship(moduleId));

      console.debug('new concept', concept);
      return concept;
    }

    /**
     * Checks if concept has basic fields required and adds them if not
     * Specifically checks one FSN, one SYNONYM, one IsA relationship
     * @param concept
     * @returns {*}
     */
    function applyMinimumFields(concept) {

      var elementFound;

      // check one FSN exists
      elementFound = false;
      angular.forEach(concept.descriptions, function (description) {
        if (description.type === 'FSN' && description.active) {
          elementFound = true;
        }
      });
      if (!elementFound) {
        concept.descriptions.push(getNewFsn());
      }

      // check one SYNONYM exists
      // TODO Consider whether to check acceptability map
      // currently left out because user can modify, and seems undesirable
      // to force a check for dialect
      elementFound = false;
      angular.forEach(concept.descriptions, function (description) {
        if (description.type === 'SYNONYM' && description.active) {
          elementFound = true;
        }
      });
      if (!elementFound) {
        concept.descriptions.push(getNewPt());
      }

      // check one relationship exists
      elementFound = false;
      angular.forEach(concept.relationships, function (relationship) {
        if (relationship.active) {
          elementFound = true;
        }
      });
      if (!elementFound) {
        concept.relationships.push(getNewIsaRelationship());
      }

      return concept;

    }

    /**
     * Function to check if a concept has minimum fields
     * @param concept
     * @returns string specifying missing field, or null if none
     */
    function hasMinimumFields(concept) {

      var elementFound;

      // check one FSN exists
      elementFound = false;
      angular.forEach(concept.descriptions, function (description) {
        if (description.type === 'FSN' && description.active) {
          elementFound = true;
        }
      });
      if (!elementFound) {
        return 'Concept does not have an active FSN';
      }

      // check one SYNONYM exists
      // TODO Consider whether to check acceptability map
      // currently left out because user can modify, and seems undesirable
      // to force a check for dialect
      elementFound = false;
      angular.forEach(concept.descriptions, function (description) {
        if (description.type === 'SYNONYM' && description.active) {
          elementFound = true;
        }
      });
      if (!elementFound) {
        return 'Concept does not have an active Synonym';
      }

      // check one IsA relationship exists
      elementFound = false;
      angular.forEach(concept.relationships, function (relationship) {
        if (relationship.type.conceptId === '116680003' && relationship.active) {
          elementFound = true;
        }
      });
      if (!elementFound) {
        return 'Concept does not have an active IsA relationship';
      }

      return concept;

    }

    function isConceptsEqual(c1, c2) {

      var i, j;

      // TODO Implement concept fields

      for (i = 0; i < c1.descriptions.length; i++) {
        for (j = 0; j < c2.descriptions.length; j++) {
          if (!isDescriptionsEqual(c1.descriptions[i], c2.descriptions[i])) {
            return false;
          }
        }
      }
      for (i = 0; i < c1.relationships.length; i++) {
        for (j = 0; j < c2.relationships.length; j++) {
          if (!isRelationshipsEqual(c1.relationships[i], c2.relationships[i])) {
            return false;
          }
        }
      }
    }

    function isDescriptionsEqual(d1, d2) {
      if (d1.descriptionId !== d2.descriptionId) {
        return false;
      }
      if (d1.active !== d2.active) {
        return false;
      }
      if (d1.term !== d2.term) {
        return false;
      }
      if (d1.type !== d2.type) {
        return false;
      }
      return true;

      // TODO Check other fields, e.g. moduleId
    }

    function isRelationshipsEqual(r1, r2) {
      if (r1.relationshipId !== r2.relationshipId) {
        return false;
      }
      if (r1.active !== r2.active) {
        return false;
      }
      if (r1.groupId !== r2.groupId) {
        return false;
      }
      if (r1.type && !r2.type) {
        return false;
      }
      if (r2.type && !r1.type) {
        return false;
      }
      if (r1.type.conceptId !== r2.type.conceptId) {
        return false;
      }
      if (r1.target && !r2.target) {
        return false;
      }
      if (r2.target && !r1.target) {
        return false;
      }
      if (r1.target.conceptId !== r2.target.conceptId) {
        return false;
      }
      return true;

      // TODO Check other fields, e.g. moduleId

    }

    function isComponentsEqual(c1, c2) {
      // determine type by id
      // NOTE descriptions have 'conceptId' field, must be checked first
      if (c1.hasOwnProperty('descriptionId') && c2.hasOwnProperty('descriptionId')) {
        return isDescriptionsEqual(c1, c2);
      } else if (c1.hasOwnProperty('relationshipId') && c2.hasOwnProperty('relationshipId')) {
        return isRelationshipsEqual(c1, c2);
      } else if (c1.hasOwnProperty('conceptId') && c2.hasOwnProperty('conceptId')) {
        return isConceptsEqual(c1, c2);
      } else {
        return false;
      }
    }

    function ptFromFsnAutomation (concept, description) {
        if (description.term.match(/.*\(.*\)/g)) {
              var ptText = description.term.substr(0, description.term.lastIndexOf('(')).trim();
              var pt = null;
              angular.forEach(concept.descriptions, function (d) {
                if (d.type === 'SYNONYM' && d.acceptabilityMap['900000000000509007'] === 'PREFERRED') {
                  if(d.term && d.term !== '' &&  d.term !== null)
                  {
                      pt = d;
                  }
                  else{
                      d.term = ptText;
                      pt = d;
                      delete pt.descriptionId;
                      return concept;
                  }

                }
              });

              // if no preferred term found for this concept, add it
              if (!pt) {
                pt = getNewPt();
                pt.term = ptText;
                concept.descriptions.push(pt);
                return concept;
              }
            } else {
              return concept;
            }
    }

    return {
      getNewConcept: getNewConcept,
      getNewDescription: getNewDescription,
      getNewFsn: getNewFsn,
      getNewPt: getNewPt,
      getNewTextDefinition: getNewTextDefinition,
      getNewIsaRelationship: getNewIsaRelationship,
      getNewAttributeRelationship: getNewAttributeRelationship,
      applyMinimumFields: applyMinimumFields,
      hasMinimumFields: hasMinimumFields,
      isComponentsEqual: isComponentsEqual,
      isConceptsEqual: isConceptsEqual,
      isDescriptionsEqual: isDescriptionsEqual,
      isRelationshipsEqual: isRelationshipsEqual,
      ptFromFsnAutomation: ptFromFsnAutomation

    };

  });
