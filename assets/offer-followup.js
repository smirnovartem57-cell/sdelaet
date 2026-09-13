(function(){
  function uniq(a){return Array.from(new Set((a||[]).filter(Boolean)))}
  function hasWork(offer,re){return (offer.worksIncluded||[]).some(function(x){return re.test(String(x).toLowerCase().replace(/ё/g,'е'))})}
  function build(task,offer){task=task||{};offer=offer||{};var items=[];var winter=/зим|круглогод/i.test(task.goal||'');
    if(offer.priceType==='from'||offer.isFromPrice===true)items.push('какая фиксированная цена после замера и от чего она может измениться');else if(offer.totalPrice==null)items.push('итоговую стоимость');
    if(offer.materialsIncluded==null)items.push('входят ли материалы в цену');
    if(task.serviceCode==='BALCONY_LEAK_REPAIR'){
      if(!offer.diagnosis)items.push('какая причина протечки / сырости подтверждена после диагностики');
      if(!offer.leakSource)items.push('где локализован источник проблемы');
      if(offer.diagnosticsCost==null&&!/диагностик.{0,20}(бесплат|включ)/i.test(offer.rawResponse||''))items.push('сколько стоит диагностика / выезд и входит ли она в итоговую цену');
      if(!offer.warranty)items.push('какая гарантия даётся именно на устранённый узел');
    }else if(task.serviceCode==='BALCONY_GLAZING'){
      if(!offer.profileSystem)items.push('какая профильная система предлагается');
      if(winter&&!offer.glassUnit)items.push('какой стеклопакет / заполнение предлагается для зимнего режима');
      if(!hasWork(offer,/(монтаж|установк).{0,18}(остеклен|окон|рам|профил)|монтаж остекления/))items.push('входит ли монтаж остекления в указанную стоимость');
      if(/стар|замен/i.test((task.currentGlazing||'')+' '+(task.scope||''))&&!hasWork(offer,/демонтаж/))items.push('входит ли демонтаж старого остекления');
      if(!/(козыр|отлив|водоотвод|нащельник|добор)/i.test((offer.rawResponse||'')+' '+(offer.worksIncluded||[]).join(' ')))items.push('учтены ли необходимые наружные элементы и водоотвод');
      if(!offer.warranty)items.push('гарантию на конструкцию и монтаж');
    }else if(task.serviceCode==='WINDOW_REPLACEMENT'){
      if(!offer.profileSystem)items.push('какая профильная система предлагается');
      if(!offer.glassUnit)items.push('какой стеклопакет предлагается');
      if(!offer.hardware)items.push('какая фурнитура предлагается');
      if(!hasWork(offer,/(монтаж|установк).{0,18}(окон|рам|профил)|монтаж окна/))items.push('входит ли монтаж окна в указанную стоимость');
      if(/замен|стар/i.test((task.goal||'')+' '+(task.scope||''))&&!hasWork(offer,/демонтаж/))items.push('входит ли демонтаж старого окна');
      if(offer.sill!==true)items.push('входит ли подоконник');
      if(offer.reveals!==true)items.push('входят ли откосы');
      if(offer.flashing!==true)items.push('входит ли наружный отлив');
      if(!offer.warranty)items.push('гарантию на конструкцию и монтаж');
    }else if(task.serviceCode==='BALCONY_FINISHING'){
      if(!offer.finishSystem)items.push('какой материал / система чистовой отделки предлагается');
      if(offer.preparationIncluded!==true)items.push('какая подготовка основания входит в стоимость');
      if(/стар|передел/i.test((task.currentState||'')+' '+(task.scope||''))&&!hasWork(offer,/демонтаж/))items.push('входит ли демонтаж старой отделки');
      if(/пол/i.test((task.scope||'')+' '+(task.surfaces||''))&&offer.floorBaseIncluded!==true)items.push('что входит в подготовку / основание пола');
      if(!offer.warranty)items.push('гарантию на отделочные работы');
    }else if(task.serviceCode==='STRETCH_CEILING'){
      var cs=((task.goal||'')+' '+(task.scope||'')+' '+(task.ceilingStyle||'')+' '+(task.cornice||'')+' '+(task.lighting||'')).toLowerCase();
      if(!offer.ceilingMaterial)items.push('какое полотно входит: ПВХ / ткань, фактура и производитель');
      if(!offer.ceilingProfile)items.push('какой профиль / система крепления входит');
      if(/светиль|люстр|lighting/.test(cs)&&offer.ceilingLightMountsIncluded!==true)items.push('входят ли закладные и монтаж светильников / люстр');
      if(/yes|карниз|ниша/.test(cs)&&offer.hiddenCorniceIncluded!==true)items.push('входит ли скрытый карниз / ниша');
      if(/floating|luminous|подсвет|светов/.test(cs)&&offer.ceilingLightLinesIncluded!==true)items.push('что входит в подсветку / световые линии и блоки питания');
      if(!offer.warranty)items.push('гарантию на полотно и монтаж');
    }else if(task.serviceCode==='INTERIOR_DOORS'){
      var ds=((task.goal||'')+' '+(task.scope||'')+' '+(task.doorType||'')+' '+(task.oldDoors||'')+' '+(task.doorKit||'')).toLowerCase();
      if(offer.doorBoxIncluded!==true)items.push('входит ли сборка / монтаж дверной коробки');
      if(offer.doorTrimIncluded!==true)items.push('входит ли установка наличников');
      if(offer.doorHingesIncluded!==true)items.push('входит ли врезка / установка петель');
      if(offer.doorLockHandleIncluded!==true)items.push('входит ли установка ручек / замков / защёлок');
      if(/yes|замен|стар/.test(ds)&&offer.doorDemolitionIncluded!==true)items.push('входит ли демонтаж старой двери');
      if(/hidden|sliding|double/.test(ds)&&offer.doorOpeningPrepIncluded!==true)items.push('какая подготовка / проверка проёма входит');
    }else if(task.serviceCode==='WALL_FINISHING'){
      var ws=((task.goal||'')+' '+(task.scope||'')+' '+(task.finishType||'')+' '+(task.wallState||'')+' '+(task.quality||'')).toLowerCase();
      var wallpaper=/wallpaper|обо/.test(ws),paint=/paint|покрас|краск/.test(ws);
      if(offer.wallPrimerIncluded!==true)items.push('входит ли грунтовка стен');
      if(offer.wallPuttyIncluded!==true)items.push('какая подготовка / шпаклёвка основания входит');
      if(paint&&offer.wallSandingIncluded!==true)items.push('входит ли шлифовка под покраску');
      if(paint&&offer.wallPaintingIncluded!==true)items.push('сколько слоёв покраски входит');
      if(wallpaper&&offer.wallpaperInstallationIncluded!==true)items.push('входит ли поклейка обоев');
      if(/old_wallpaper|old_paint|стар/.test(ws)&&offer.wallDemolitionIncluded!==true)items.push('входит ли демонтаж старого покрытия');
    }else if(task.serviceCode==='FLOORING_INSTALLATION'){
      var fs=((task.goal||'')+' '+(task.scope||'')+' '+(task.flooringType||'')+' '+(task.layout||'')+' '+(task.baseState||'')).toLowerCase();
      if(!offer.flooringType)items.push('какой тип покрытия учтён');
      if(!offer.flooringLayout)items.push('какая схема укладки учтена');
      if(offer.floorBasePreparationIncluded!==true)items.push('входит ли подготовка / выравнивание основания');
      if(/laminate|spc|engineered|ламинат|паркет|кварц/.test(fs)&&offer.underlayIncluded!==true&&offer.installationMethod!=='glued')items.push('входит ли подложка и какая');
      if(/engineered|паркет/.test(fs)&&!offer.installationMethod)items.push('укладка замковая или клеевая');
      if(/old_covering|стар.{0,10}покрыт/.test(fs)&&offer.floorDemolitionIncluded!==true)items.push('входит ли демонтаж старого покрытия');
    }else if(task.serviceCode==='TILE_INSTALLATION'){
      var ts=((task.goal||'')+' '+(task.scope||'')+' '+(task.tileZone||'')+' '+(task.tileFormat||'')+' '+(task.layout||'')).toLowerCase();
      if(!offer.tileFormat)items.push('какой тип и формат плитки учтён в цене');
      if(!offer.tileLayout)items.push('какая раскладка учтена в цене');
      if(offer.substratePreparationIncluded!==true)items.push('входит ли подготовка / выравнивание основания');
      if(/wet_room|ванн|сануз|душ/.test(ts)&&offer.waterproofingIncluded!==true)items.push('входит ли гидроизоляция пола и мокрых зон');
      if(!offer.groutType)items.push('какая затирка входит');
      if(offer.tileCutsIncluded!==true)items.push('входят ли подрезки и отверстия');
    }else if(task.serviceCode==='WALL_PLASTERING'){
      if(!offer.plasterSystem)items.push('какая система штукатурки / смесь предлагается');
      if(!offer.layerThickness)items.push('какая средняя и максимальная толщина слоя заложена');
      if(offer.basePrimerIncluded!==true)items.push('входит ли подготовка / грунтовка основания');
      if(offer.beaconsIncluded!==true)items.push('входят ли маяки / контроль плоскости');
      if(/yes|стар/.test(String(task.oldLayer||'').toLowerCase())&&offer.baseDemolitionIncluded!==true)items.push('входит ли демонтаж слабой старой штукатурки');
    }else if(task.serviceCode==='FLOOR_SCREED'){
      if(!offer.screedType)items.push('какой тип стяжки учтён');
      if(!offer.layerThickness)items.push('какая средняя / максимальная толщина слоя заложена');
      if(!offer.strengthSpec&&offer.screedType!=='dry')items.push('какая марка / прочность смеси');
      if(offer.edgeTapeIncluded!==true&&offer.screedType!=='self_leveling')items.push('входит ли демпферная лента / краевой узел');
      if(/yes|стар/.test(String(task.oldScreed||'').toLowerCase())&&offer.baseDemolitionIncluded!==true)items.push('входит ли демонтаж старой стяжки');
    }else if(task.serviceCode==='DRYWALL_PARTITIONS'){
      if(!offer.frameSpec)items.push('какой профиль / каркас используется');
      if(!offer.studSpacing)items.push('какой шаг стоек каркаса');
      if(!offer.boardType)items.push('какой тип листов используется');
      if(!offer.boardLayers)items.push('сколько слоёв обшивки с каждой стороны');
      if(/yes|звук/.test(String(task.soundRequirement||'').toLowerCase())&&offer.partitionFillIncluded!==true)items.push('какое звукоизоляционное заполнение входит');
      if(offer.jointFinishIncluded!==true)items.push('входит ли заделка / армирование стыков');
    }else if(task.serviceCode==='SOUNDPROOFING'){
      if(!offer.acousticArea&&!offer.workArea)items.push('какая площадь и поверхность учтены');
      if(!offer.acousticSystemType)items.push('какая система звукоизоляции предлагается');
      if(!offer.acousticThickness)items.push('какая итоговая толщина системы');
      if(!offer.acousticLayers)items.push('сколько слоёв входит в систему');
      if(offer.vibrationIsolationIncluded!==true)items.push('как выполнена виброразвязка каркаса и креплений');
      if(offer.junctionTreatmentIncluded!==true)items.push('как обработаны примыкания и акустические швы');
      if(offer.acousticMaterialsSpecified!==true)items.push('какие материалы и марки входят');
    }else if(task.serviceCode==='BATHROOM_WATERPROOFING'){
      if(!offer.workArea)items.push('какая площадь пола и стен учтена');
      if(!offer.waterproofingSystem)items.push('какая система гидроизоляции применяется');
      if(!offer.waterproofingLayers)items.push('сколько слоёв наносится');
      if(offer.waterproofingSurfacePreparationIncluded!==true)items.push('входит ли подготовка и грунтование основания');
      if(offer.cornerTapeIncluded!==true)items.push('входят ли ленты углов и примыканий');
      if(offer.pipePenetrationsIncluded!==true)items.push('как герметизируются проходки труб и трап');
      if(!offer.waterproofingWallHeight)items.push('какая высота захода гидроизоляции на стены');
      if(!offer.dryingTime)items.push('какое время межслойной сушки и полного высыхания');
    }else if(task.serviceCode==='ROOF_REPAIR'){
      if(!offer.roofType)items.push('какой тип кровли учтён');
      if(offer.roofDiagnosis!==true)items.push('входит ли диагностика причины протечки');
      if(!offer.roofRepairArea)items.push('какая площадь ремонта заложена');
      if(!offer.roofRepairMethod)items.push('какой метод ремонта предлагается');
      if(offer.roofMaterialsSpecified!==true)items.push('какие материалы и марки входят');
      if(offer.roofFlashingIncluded!==true)items.push('входят ли примыкания и водоотвод');
      if(offer.roofAccessIncluded!==true)items.push('включены ли доступ и высотные работы');
    }else if(task.serviceCode==='UNDERFLOOR_HEATING'){
      if(!offer.heatedFloorType)items.push('какой тип тёплого пола предлагается');
      if(!offer.heatedArea)items.push('какая фактическая площадь обогрева учтена');
      if(!offer.heatingElementSpec)items.push('какая модель / нагревательный элемент входит');
      if(!offer.heatedFloorPowerSpec&&offer.heatedFloorType!=='water')items.push('какая удельная мощность системы');
      if(offer.thermostatIncluded!==true&&offer.heatedFloorType!=='water')items.push('какой терморегулятор входит');
      if(offer.floorSensorIncluded!==true&&offer.heatedFloorType!=='water')items.push('входит ли датчик пола в гофротрубке');
      if(offer.heatedFloorBasePreparationIncluded!==true)items.push('входит ли подготовка основания');
      if(offer.floorInsulationIncluded!==true)items.push('какой теплоизоляционный слой предусмотрен');
      if(offer.heatedFloorType!=='water'&&offer.heatedFloorElectricalConnectionIncluded!==true)items.push('входит ли электроподключение');
      if(offer.heatedFloorType!=='water'&&offer.heatedFloorProtectionIncluded!==true)items.push('какая защитная автоматика предусмотрена');
    }else if(task.serviceCode==='ENTRANCE_DOORS'){
      if(!offer.entranceDoorModel)items.push('какая точная модель двери предлагается');
      if(!offer.entranceDoorDimensions)items.push('какой размер дверного блока учтён');
      if(offer.entranceDoorConstructionSpecified!==true)items.push('какая конструкция полотна и коробки');
      if(offer.entranceDoorLocksSpecified!==true)items.push('какие замки и фурнитура входят');
      if(offer.entranceDoorPerformanceSpecified!==true)items.push('какие тепло- и звукоизоляционные характеристики заявлены');
      if(/yes|замен|стар/.test(String(task.oldDoor||'').toLowerCase())&&offer.entranceDoorDemolitionIncluded!==true)items.push('входит ли демонтаж и вывоз старой двери');
      if(offer.entranceAnchoringIncluded!==true)items.push('как крепится коробка');
      if(offer.entranceSealingIncluded!==true)items.push('как герметизируется монтажный шов');
      if(offer.deliveryLiftIncluded!==true)items.push('входят ли доставка и подъём');
    }else if(task.serviceCode==='DEMOLITION_WORKS'){
      if(!offer.demolitionScope)items.push('какой точный перечень демонтажа входит');
      if(!offer.demolitionMaterial)items.push('какие материалы, толщины и объёмы учтены');
      if(/стен|перегород|проем/.test(((task.goal||'')+' '+(task.scope||'')).toLowerCase())&&offer.structuralStatusConfirmed!==true)items.push('как подтверждено, что конструкция не несущая');
      if(/yes|коммуникац|электр|труб|газ/.test(String(task.utilities||'').toLowerCase()+' '+String(task.scope||'').toLowerCase())&&offer.utilitiesIsolated!==true)items.push('кто и как отключает коммуникации');
      if(offer.demolitionProtectionIncluded!==true)items.push('как защищаются помещение, лифт и общие зоны');
      if(offer.dustControlIncluded!==true)items.push('какие меры пылезащиты предусмотрены');
      if(offer.debrisPackingIncluded!==true)items.push('входит ли упаковка мусора');
      if(offer.debrisLoadingIncluded!==true)items.push('входит ли погрузка');
      if(offer.debrisTransportIncluded!==true)items.push('входит ли транспорт / вывоз');
      if(offer.legalDisposalIncluded!==true)items.push('куда вывозятся отходы и чем подтверждается утилизация');
      if(offer.floorLiftSpecified!==true)items.push('какой этаж, лифт и спуск учтены');
    }else if(task.serviceCode==='BATHROOM_RENOVATION'){
      if(!offer.bathroomRenovationScope)items.push('какой полный состав ремонта входит');
      if(offer.bathroomSubstratePreparationIncluded!==true)items.push('какая подготовка оснований входит');
      if(offer.bathroomWaterproofingIncluded!==true)items.push('какая гидроизоляция пола и мокрых зон входит');
      if(offer.bathroomPlumbingIncluded!==true)items.push('какой состав сантехнических работ входит');
      if(offer.bathroomElectricalIncluded!==true)items.push('какой состав электромонтажа и проверки входит');
      if(offer.bathroomTileIncluded!==true)items.push('какие плиточные работы, подрезки и затирка входят');
      if(offer.bathroomFixturesIncluded!==true)items.push('входит ли монтаж всех сантехнических приборов');
      if(offer.bathroomWasteRemovalIncluded!==true)items.push('входит ли упаковка и вывоз мусора');
    }else if(task.serviceCode==='KITCHEN_INSTALLATION'){
      if(!offer.kitchenLayout)items.push('какая планировка кухни учтена');
      if(!offer.kitchenModuleCount)items.push('сколько модулей входит в цену');
      if(offer.kitchenAssemblyIncluded!==true)items.push('входит ли сборка всех модулей');
      if(offer.kitchenAnchoringIncluded!==true)items.push('как выполняются выравнивание и крепление');
      if(offer.kitchenCountertopIncluded!==true)items.push('входит ли монтаж и стыковка столешницы');
      if(offer.kitchenCutsIncluded!==true)items.push('входят ли вырезы под мойку и варочную панель');
      if(offer.kitchenAppliancesIncluded!==true)items.push('какая техника устанавливается');
      if(/gas|газ/.test(String(task.connections||'').toLowerCase())&&offer.kitchenGasIncluded!==true)items.push('кто выполняет допустимое газовое подключение');
    }else if(task.serviceCode==='WATER_HEATER_INSTALLATION'){
      if(!offer.waterHeaterType)items.push('какой тип водонагревателя');
      if(!offer.waterHeaterModel)items.push('какая точная модель устанавливается');
      if(offer.waterHeaterType==='storage'&&!offer.waterHeaterVolume)items.push('какой объём бака');
      if(offer.waterHeaterAnchorsIncluded!==true)items.push('какое крепление и анкеры предусмотрены');
      if(offer.waterHeaterPlumbingIncluded!==true)items.push('что входит в подключение воды');
      if(offer.waterHeaterValvesIncluded!==true)items.push('какие краны и арматура входят');
      if(offer.waterHeaterSafetyGroupIncluded!==true)items.push('какая группа безопасности входит');
      if(offer.waterHeaterDrainIncluded!==true)items.push('куда организован безопасный слив');
      if(offer.waterHeaterElectricalIncluded!==true)items.push('как выполняется электроподключение');
      if(offer.waterHeaterProtectionIncluded!==true)items.push('какие защита и заземление предусмотрены');
      if(offer.waterHeaterCommissioningIncluded!==true)items.push('входят ли пуск и проверка герметичности');
    }else if(task.serviceCode==='VENTILATION_EXHAUST'){
      if(!offer.ventilationAirflowSpec)items.push('какой расчётный расход воздуха');if(!offer.ductRoute)items.push('какой маршрут воздуховода');if(!offer.ductDiameter)items.push('какой диаметр канала');if(!offer.fanModel)items.push('какая модель вентилятора');if(offer.backdraftValveIncluded!==true)items.push('входит ли обратный клапан');if(offer.airTransferIncluded!==true)items.push('как обеспечен приток / переток');if(offer.ventilationElectricalIncluded!==true)items.push('что входит в электроподключение');if(offer.ventilationCommissioningIncluded!==true)items.push('входят ли пуск и проверка тяги');
    }else if(task.serviceCode==='FACADE_INSULATION'){
      if(!offer.facadeArea)items.push('какая площадь фасада');if(!offer.facadeSystem)items.push('какая фасадная система');if(!offer.facadeInsulationMaterial)items.push('какой материал утеплителя');if(!offer.facadeThickness)items.push('какая толщина утеплителя');if(!offer.facadeGrade)items.push('какая марка или плотность');if(offer.facadeBasePreparationIncluded!==true)items.push('какая подготовка основания входит');if(offer.facadeFastenersIncluded!==true)items.push('какой крепёж входит');if(offer.facadeReinforcementIncluded!==true)items.push('какой армирующий слой входит');if(offer.facadeFinishIncluded!==true)items.push('какой финиш входит');if(offer.facadeJunctionsIncluded!==true)items.push('как учтены проёмы и примыкания');if(offer.scaffoldingIncluded!==true)items.push('входят ли леса и доступ');
    }else if(task.serviceCode==='MOLD_REMEDIATION'){
      if(!offer.moldAffectedArea)items.push('какая площадь поражения');if(!offer.moldDiagnosticMethod)items.push('какой метод диагностики');if(!offer.moistureSource)items.push('какой источник влаги установлен');if(offer.moistureMeasurementIncluded!==true)items.push('входят ли замеры влажности');if(offer.ventilationCheckIncluded!==true)items.push('входит ли проверка вентиляции');if(offer.leakCheckIncluded!==true)items.push('входит ли поиск протечки');if(offer.moldRemovalIncluded!==true)items.push('как удаляется поражение');if(offer.containmentIncluded!==true)items.push('как изолируется и защищается зона');if(!offer.treatmentSystem)items.push('какая система обработки');if(offer.dryingIncluded!==true)items.push('входит ли сушка');if(offer.restorationIncluded!==true)items.push('какое восстановление входит');if(offer.followupControlIncluded!==true)items.push('входит ли контрольный осмотр');
    }else if(task.serviceCode==='MINOR_APARTMENT_REPAIR'){
      var ms=((task.goal||'')+' '+(task.scope||'')+' '+(task.repairJob||'')+' '+(task.workList||'')).toLowerCase();
      if(/mounting|креп|полк|карниз|зеркал|телевиз/.test(ms)&&offer.fastenersSpecified!==true)items.push('какой крепёж / расходники входят и кто их предоставляет');
      if(/mounting|креп|полк|карниз|зеркал|телевиз/.test(ms)&&offer.drillingIncluded!==true)items.push('входит ли сверление и монтаж крепежа');
      if(offer.minimumVisit==null)items.push('есть ли минимальная стоимость выезда / заказа');
      if(!offer.warranty)items.push('гарантию на выполненные работы');
    }else if(task.serviceCode==='RADIATOR_HEATING'){
      var hs=((task.goal||'')+' '+(task.scope||'')+' '+(task.heatingJob||'')+' '+(task.system||'')+' '+(task.riserWork||'')).toLowerCase();
      if(!offer.radiatorSpec&&!/valves/.test(hs))items.push('какой радиатор: модель / мощность / размер предлагается');
      if(!offer.heatingConnection&&!/valves/.test(hs))items.push('какая схема подключения радиатора');
      if(offer.heatingValvesIncluded!==true)items.push('какие краны / клапаны / комплектующие входят');
      if(/central|стояк|yes/.test(hs)&&offer.riserWorkIncluded!==true)items.push('как организуется отключение и работы со стояком');
      if(offer.heatingPressureTestIncluded!==true)items.push('входит ли опрессовка / проверка герметичности после монтажа');
      if(!offer.warranty)items.push('гарантию на монтаж и соединения');
    }else if(task.serviceCode==='PLUMBING_WORKS'){
      var pscope=((task.goal||'')+' '+(task.scope||'')+' '+(task.plumbingJob||'')+' '+(task.currentState||'')).toLowerCase();
      var network=/(развод|water_distribution|relocation|труб|водоснабж)/.test(pscope),drain=/(канализац|drainage|слив)/.test(pscope),fixture=/(fixture|смесител|унитаз|раковин|ванн)/.test(pscope);
      if(network&&!offer.pipeSystem)items.push('какая система труб и фитингов предлагается');
      if(network&&!offer.distributionScheme)items.push('какая схема разводки предлагается — коллекторная или тройниковая');
      if(network&&offer.waterDistributionIncluded!==true)items.push('что именно входит в разводку водоснабжения');
      if(network&&offer.pressureTestIncluded!==true)items.push('будет ли выполнена опрессовка / проверка герметичности после монтажа');
      if(drain&&offer.drainageIncluded!==true)items.push('что входит в канализацию / слив и как определяется трасса');
      if(fixture&&!offer.fixtureType)items.push('какой именно прибор / узел устанавливается или заменяется');
      if(/замен/.test(pscope)&&offer.plumbingDemolitionIncluded!==true)items.push('входит ли демонтаж существующего оборудования');
      if(!offer.warranty)items.push('гарантию на сантехнические работы и соединения');
    }else if(task.serviceCode==='ELECTRICAL_INSTALLATION'){
      var scope=((task.goal||'')+' '+(task.scope||'')+' '+(task.electricalJob||'')+' '+(task.panelScope||'')).toLowerCase();
      if(!offer.cableSpec&&/(лини|проводк|розет|выключател)/.test(scope))items.push('какой кабель и сечение закладываются');
      if(!offer.routeSpec&&/(лини|проводк|розет|выключател)/.test(scope))items.push('как будет проложен кабель и что входит в подготовку трассы');
      if(offer.cableLayingIncluded!==true&&/(лини|проводк|розет|выключател)/.test(scope))items.push('входит ли прокладка кабеля в указанную стоимость');
      if(/щит|panel|replace|extend/.test(scope)&&offer.panelIncluded!==true)items.push('что именно входит в работы по электрощиту');
      if(/щит|panel|replace|extend/.test(scope)&&!offer.protectionSpec)items.push('какие автоматы / УЗО / дифавтоматы входят в смету');
      if(offer.testingIncluded!==true)items.push('какая проверка / измерения выполняются после монтажа');
      if(!offer.warranty)items.push('гарантию на электромонтажные работы');
    }else if(task.serviceCode==='WINDOW_REPAIR'){
      if(!offer.diagnosis)items.push('какая причина неисправности подтверждена после осмотра');
      if(!offer.repairType)items.push('какой конкретно ремонт требуется');
      if(offer.visitCost==null&&!offer.diagnosticsIncluded)items.push('сколько стоит выезд / диагностика');
      if(offer.partsIncluded==null)items.push('входят ли необходимые детали / запчасти в цену');
      if(!offer.warranty)items.push('гарантию на выполненный ремонт и заменённые детали');
      if(/конден|запот/i.test((task.goal||'')+' '+(task.scope||'')+' '+(task.description||''))&&!/(вентиляц|влажност|температур|причин)/i.test(offer.rawResponse||''))items.push('как будет диагностирована причина конденсата, а не только само окно');
    }else{
      if(!offer.leadTime)items.push('срок выполнения');
      if(!offer.warranty)items.push('гарантию на работы');
      if(winter){if(!hasWork(offer,/утепл.{0,12}пол/))items.push('входит ли утепление пола');if(!hasWork(offer,/утепл.{0,12}потол/))items.push('входит ли утепление потолка');if(!hasWork(offer,/утепл.{0,15}(стен|парапет)/))items.push('входит ли утепление стен / парапета');if(!hasWork(offer,/(гермет|примыкан|монтажн.{0,8}шв)/))items.push('учтена ли герметизация примыканий');if(!hasWork(offer,/(провер|осмотр|диагност).{0,18}(остеклен|окон)/))items.push('будет ли проверено существующее остекление на пригодность для зимнего режима');}
    }
    if((offer.exclusions||[]).length===0&&offer.materialsIncluded!==false)items.push('что не входит в указанную стоимость');
    items=uniq(items).slice(0,6);
    if(!items.length)return{needed:false,items:[],message:'Спасибо. Предложение достаточно полное для предварительного сравнения.'};
    return{needed:true,items:items,message:'Спасибо. Уточните, пожалуйста: '+items.join('; ')+'.'};
  }
  window.sdOfferFollowup={build:build};
})();